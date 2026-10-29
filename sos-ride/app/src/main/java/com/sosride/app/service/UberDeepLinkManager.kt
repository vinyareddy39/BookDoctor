package com.sosride.app.service

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import java.net.URLEncoder

object UberDeepLinkManager {

    private const val TAG = "UberDeepLinkManager"
    const val UBER_PACKAGE_NAME = "com.ubercab"

    fun isUberInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo(UBER_PACKAGE_NAME, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking Uber installation: ${e.message}")
            false
        }
    }

    /**
     * Builds and launches the Uber deep link.
     * Native scheme: uber://?action=setPickup&...
     * Fallback web scheme: https://m.uber.com/ul/?action=setPickup&...
     */
    fun launchUber(
        context: Context,
        pickupLat: Double,
        pickupLng: Double,
        dropoffLat: Double,
        dropoffLng: Double,
        dropoffName: String
    ): Boolean {
        val encodedName = try {
            URLEncoder.encode(dropoffName, "UTF-8")
        } catch (e: Exception) {
            "Emergency Hospital"
        }

        val queryParams = "action=setPickup" +
                "&pickup[latitude]=$pickupLat" +
                "&pickup[longitude]=$pickupLng" +
                "&dropoff[latitude]=$dropoffLat" +
                "&dropoff[longitude]=$dropoffLng" +
                "&dropoff[nickname]=$encodedName"

        val nativeUriString = "uber://?$queryParams"
        val webFallbackUriString = "https://m.uber.com/ul/?$queryParams"

        val isInstalled = isUberInstalled(context)
        Log.d(TAG, "Uber app installed: $isInstalled. Generating deep link...")

        return if (isInstalled) {
            try {
                Log.d(TAG, "Launching native Uber URI: $nativeUriString")
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(nativeUriString)).apply {
                    setPackage(UBER_PACKAGE_NAME)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                context.startActivity(intent)
                true
            } catch (e: Exception) {
                Log.w(TAG, "Failed to launch native Uber app directly, attempting generic VIEW: ${e.message}")
                launchGenericUri(context, nativeUriString) || launchGenericUri(context, webFallbackUriString)
            }
        } else {
            Log.w(TAG, "Uber app not installed. Launching browser fallback: $webFallbackUriString")
            launchGenericUri(context, webFallbackUriString)
        }
    }

    private fun launchGenericUri(context: Context, uriString: String): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uriString)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open URI: $uriString", e)
            false
        }
    }
}
