package com.sosride.app.data.api

import android.location.Location
import android.util.Log
import com.sosride.app.data.model.Hospital
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class OverpassService(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .build()
) {

    companion object {
        private const val TAG = "OverpassService"
        private const val PRIMARY_URL = "https://overpass-api.de/api/interpreter"
        private const val BACKUP_URL = "https://overpass.kumi.systems/api/interpreter"
    }

    suspend fun findNearestEmergencyHospitals(
        userLat: Double,
        userLng: Double
    ): Result<List<Hospital>> = withContext(Dispatchers.IO) {
        // Overpass query strictly filtering for hospitals with verified emergency departments (emergency=yes)
        val query = """
            [out:json][timeout:12];
            (
              node["amenity"="hospital"]["emergency"="yes"](around:25000,$userLat,$userLng);
              way["amenity"="hospital"]["emergency"="yes"](around:25000,$userLat,$userLng);
              relation["amenity"="hospital"]["emergency"="yes"](around:25000,$userLat,$userLng);
            );
            out center;
        """.trimIndent()

        Log.d(TAG, "Querying OpenStreetMap Overpass fallback for emergency hospitals near $userLat, $userLng")

        val result = tryEndpoint(PRIMARY_URL, query, userLat, userLng)
        if (result.isSuccess && result.getOrNull()?.isNotEmpty() == true) {
            return@withContext result
        }

        Log.w(TAG, "Primary Overpass endpoint failed or empty, trying backup endpoint...")
        tryEndpoint(BACKUP_URL, query, userLat, userLng)
    }

    private fun tryEndpoint(
        endpointUrl: String,
        query: String,
        userLat: Double,
        userLng: Double
    ): Result<List<Hospital>> {
        return try {
            val mediaType = "application/x-www-form-urlencoded; charset=utf-8".toMediaType()
            val body = "data=${java.net.URLEncoder.encode(query, "UTF-8")}".toRequestBody(mediaType)

            val request = Request.Builder()
                .url(endpointUrl)
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val code = response.code
                    Log.e(TAG, "Overpass HTTP error: $code on $endpointUrl")
                    return Result.failure(IllegalStateException("Overpass HTTP error: $code"))
                }

                val bodyString = response.body?.string()
                if (bodyString.isNullOrBlank()) {
                    return Result.failure(IllegalStateException("Empty response from Overpass API"))
                }

                val json = JSONObject(bodyString)
                val elements = json.optJSONArray("elements")
                if (elements == null || elements.length() == 0) {
                    Log.w(TAG, "Overpass returned 0 hospital elements")
                    return Result.success(emptyList())
                }

                val hospitals = mutableListOf<Hospital>()
                for (i in 0 until elements.length()) {
                    val el = elements.getJSONObject(i)
                    val id = el.optLong("id", i.toLong()).toString()
                    val tags = el.optJSONObject("tags")

                    val rawName = tags?.optString("name", null)
                        ?: tags?.optString("name:en", null)
                        ?: tags?.optString("official_name", "Emergency Medical Center")
                        ?: "Emergency Medical Center"

                    var lat = el.optDouble("lat", Double.NaN)
                    var lng = el.optDouble("lon", Double.NaN)

                    // For ways and relations, coordinate is inside "center" object
                    if (lat.isNaN() || lng.isNaN()) {
                        val center = el.optJSONObject("center")
                        if (center != null) {
                            lat = center.optDouble("lat", Double.NaN)
                            lng = center.optDouble("lon", Double.NaN)
                        }
                    }

                    if (!lat.isNaN() && !lng.isNaN()) {
                        val distanceResults = FloatArray(1)
                        Location.distanceBetween(userLat, userLng, lat, lng, distanceResults)
                        val distMeters = distanceResults[0].toDouble()

                        val isEmergency = tags?.optString("emergency", "yes") != "no"
                        val street = tags?.optString("addr:street", null)
                        val city = tags?.optString("addr:city", null)
                        val address = listOfNotNull(street, city).joinToString(", ").ifEmpty { null }
                        val phone = tags?.optString("phone", null) ?: tags?.optString("contact:phone", null)

                        hospitals.add(
                            Hospital(
                                id = "osm_$id",
                                name = rawName,
                                latitude = lat,
                                longitude = lng,
                                address = address,
                                distanceMeters = distMeters,
                                openNow = true,
                                hasEmergencyDepartment = isEmergency,
                                phone = phone,
                                source = "OpenStreetMap"
                            )
                        )
                    }
                }

                // Rank candidates by straight-line (great-circle / Haversine) distance in meters
                val sorted = hospitals.sortedBy { it.distanceMeters }
                Log.d(TAG, "Overpass found ${sorted.size} hospitals. Nearest: ${sorted.firstOrNull()?.name} (${sorted.firstOrNull()?.formattedDistance})")
                Result.success(sorted)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Overpass query failed on $endpointUrl: ${e.message}", e)
            Result.failure(e)
        }
    }
}
