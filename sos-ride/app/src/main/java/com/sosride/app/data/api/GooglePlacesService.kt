package com.sosride.app.data.api

import android.location.Location
import android.util.Log
import com.sosride.app.BuildConfig
import com.sosride.app.data.model.Hospital
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class GooglePlacesService(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()
) {

    companion object {
        private const val TAG = "GooglePlacesService"
        private const val BASE_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    }

    suspend fun findNearestEmergencyHospitals(
        userLat: Double,
        userLng: Double
    ): Result<List<Hospital>> = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.PLACES_API_KEY
        if (apiKey.isBlank() || apiKey == "YOUR_GOOGLE_PLACES_API_KEY") {
            Log.w(TAG, "Google Places API key is missing or set to placeholder in local.properties.")
            return@withContext Result.failure(IllegalStateException("Google Places API key is not configured"))
        }

        try {
            // Search for hospitals with emergency department within 20km radius
            val url = "$BASE_URL?location=$userLat,$userLng&radius=20000&type=hospital&keyword=emergency&key=$apiKey"
            Log.d(TAG, "Querying Google Places API for emergency hospitals near $userLat, $userLng")

            val request = Request.Builder()
                .url(url)
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val code = response.code
                    val errorMsg = "Google Places API HTTP error: $code"
                    Log.e(TAG, errorMsg)
                    return@withContext Result.failure(IllegalStateException(errorMsg))
                }

                val bodyString = response.body?.string()
                if (bodyString.isNullOrBlank()) {
                    return@withContext Result.failure(IllegalStateException("Empty response from Google Places API"))
                }

                val json = JSONObject(bodyString)
                val status = json.optString("status", "")
                if (status != "OK" && status != "ZERO_RESULTS") {
                    val errMsg = json.optString("error_message", "Google Places status: $status")
                    Log.w(TAG, "Places API returned non-OK status: $status, error: $errMsg")
                    return@withContext Result.failure(IllegalStateException("Places API: $status - $errMsg"))
                }

                val resultsArray = json.optJSONArray("results")
                if (resultsArray == null || resultsArray.length() == 0) {
                    Log.w(TAG, "Google Places returned 0 emergency hospitals nearby")
                    return@withContext Result.success(emptyList())
                }

                val hospitals = mutableListOf<Hospital>()
                for (i in 0 until resultsArray.length()) {
                    val place = resultsArray.getJSONObject(i)
                    val placeId = place.optString("place_id", "places_$i")
                    val name = place.optString("name", "Emergency Hospital")
                    val geometry = place.optJSONObject("geometry")
                    val locObj = geometry?.optJSONObject("location")
                    val lat = locObj?.optDouble("lat", Double.NaN) ?: Double.NaN
                    val lng = locObj?.optDouble("lng", Double.NaN) ?: Double.NaN
                    val address = place.optString("vicinity", null)
                    val openingHours = place.optJSONObject("opening_hours")
                    val openNow = if (openingHours != null && openingHours.has("open_now")) {
                        openingHours.optBoolean("open_now", true)
                    } else true

                    if (!lat.isNaN() && !lng.isNaN()) {
                        val distanceResults = FloatArray(1)
                        Location.distanceBetween(userLat, userLng, lat, lng, distanceResults)
                        val distMeters = distanceResults[0].toDouble()

                        hospitals.add(
                            Hospital(
                                id = placeId,
                                name = name,
                                latitude = lat,
                                longitude = lng,
                                address = address,
                                distanceMeters = distMeters,
                                openNow = openNow,
                                hasEmergencyDepartment = true,
                                source = "Google Places"
                            )
                        )
                    }
                }

                // Sort by real physical distance to user
                val sorted = hospitals.sortedBy { it.distanceMeters }
                Log.d(TAG, "Successfully found ${sorted.size} hospitals via Google Places. Closest: ${sorted.firstOrNull()?.name} (${sorted.firstOrNull()?.formattedDistance})")
                Result.success(sorted)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception during Google Places search: ${e.message}", e)
            Result.failure(e)
        }
    }
}
