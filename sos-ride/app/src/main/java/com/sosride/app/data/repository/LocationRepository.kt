package com.sosride.app.data.repository

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

class LocationRepository(private val context: Context) {

    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    companion object {
        private const val TAG = "LocationRepository"
        private const val LOCATION_TIMEOUT_MS = 12000L // 12 seconds max for fresh high-accuracy GPS fix
    }

    fun isGpsEnabled(): Boolean {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        return locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
                locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
    }

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(): Result<Location> {
        return try {
            if (!isGpsEnabled()) {
                Log.w(TAG, "GPS is disabled on device")
                return Result.failure(IllegalStateException("GPS / Location Services is disabled on this device"))
            }

            Log.d(TAG, "Requesting fresh high-accuracy location fix...")
            val cts = CancellationTokenSource()

            // Try getting current fresh high accuracy location within timeout
            val freshLocation = withTimeoutOrNull(LOCATION_TIMEOUT_MS) {
                fusedLocationClient.getCurrentLocation(
                    Priority.PRIORITY_HIGH_ACCURACY,
                    cts.token
                ).await()
            }

            if (freshLocation != null) {
                Log.d(TAG, "Acquired fresh high-accuracy location: ${freshLocation.latitude}, ${freshLocation.longitude} (accuracy: ${freshLocation.accuracy}m)")
                return Result.success(freshLocation)
            }

            // Fallback to last known location if fresh fix timed out
            Log.w(TAG, "Fresh location fix timed out. Falling back to last known location...")
            val lastLocation = fusedLocationClient.lastLocation.await()
            if (lastLocation != null) {
                Log.d(TAG, "Acquired last known location: ${lastLocation.latitude}, ${lastLocation.longitude}")
                return Result.success(lastLocation)
            }

            Result.failure(IllegalStateException("Unable to determine GPS location. Please check signal and permissions."))
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission missing", e)
            Result.failure(e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get location", e)
            Result.failure(e)
        }
    }
}
