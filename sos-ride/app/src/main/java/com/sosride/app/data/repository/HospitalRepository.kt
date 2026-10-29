package com.sosride.app.data.repository

import android.util.Log
import com.sosride.app.data.api.GooglePlacesService
import com.sosride.app.data.api.OverpassService
import com.sosride.app.data.model.Hospital

class HospitalRepository(
    private val placesService: GooglePlacesService = GooglePlacesService(),
    private val overpassService: OverpassService = OverpassService()
) {

    companion object {
        private const val TAG = "HospitalRepository"
    }

    suspend fun getNearestEmergencyHospital(
        userLat: Double,
        userLng: Double
    ): Result<Hospital> {
        Log.d(TAG, "Initiating emergency hospital lookup for location: $userLat, $userLng")

        // 1. Primary Strategy: Google Places API (Nearby Search)
        val placesResult = placesService.findNearestEmergencyHospitals(userLat, userLng)
        if (placesResult.isSuccess) {
            val list = placesResult.getOrNull().orEmpty()
            if (list.isNotEmpty()) {
                val nearest = list.first()
                Log.d(TAG, "Primary match found via Google Places: ${nearest.name} (${nearest.formattedDistance})")
                return Result.success(nearest)
            } else {
                Log.w(TAG, "Google Places returned zero results, falling back to OpenStreetMap Overpass...")
            }
        } else {
            Log.w(TAG, "Google Places failed: ${placesResult.exceptionOrNull()?.message}. Falling back to OpenStreetMap Overpass...")
        }

        // 2. Secondary Strategy: OpenStreetMap Overpass API
        val overpassResult = overpassService.findNearestEmergencyHospitals(userLat, userLng)
        if (overpassResult.isSuccess) {
            val list = overpassResult.getOrNull().orEmpty()
            if (list.isNotEmpty()) {
                val nearest = list.first()
                Log.d(TAG, "Secondary match found via OpenStreetMap Overpass: ${nearest.name} (${nearest.formattedDistance})")
                return Result.success(nearest)
            } else {
                Log.e(TAG, "OpenStreetMap Overpass also returned zero emergency hospitals in 25km radius.")
            }
        } else {
            Log.e(TAG, "OpenStreetMap Overpass also failed: ${overpassResult.exceptionOrNull()?.message}")
        }

        // 3. Fallback: If both Google Places and OpenStreetMap Overpass fail to return an emergency hospital,
        // do NOT invent fake or hard-coded coordinates. Return failure so the flow skips Uber and shows 108/112 buttons.
        Log.e(TAG, "No emergency hospital candidates found nearby. Skipping Uber dispatch.")
        return Result.failure(IllegalStateException("No emergency hospitals found nearby via Google Places or OpenStreetMap Overpass"))
    }
}
