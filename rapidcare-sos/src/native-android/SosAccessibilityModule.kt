package com.sosride.accessibility

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * SosAccessibilityModule
 * Exposes accessibility controls to React Native with Promises and event emissions.
 */
class SosAccessibilityModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SosAccessibilityModule"

    companion object {
        private var instance: SosAccessibilityModule? = null

        fun sendEvent(eventName: String, params: Bundle?) {
            val reactCtx = instance?.reactContext ?: return
            val map = if (params != null) Arguments.fromBundle(params) else Arguments.createMap()
            reactCtx
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, map)
        }
    }

    init {
        instance = this
    }

    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        try {
            val context: Context = reactContext.applicationContext
            val expectedServiceName = "${context.packageName}/${SosAccessibilityService::class.java.canonicalName}"
            val enabledServicesSetting = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )

            if (enabledServicesSetting.isNullOrEmpty()) {
                promise.resolve(false)
                return
            }

            val colonSplitter = TextUtils.SimpleStringSplitter(':')
            colonSplitter.setString(enabledServicesSetting)

            while (colonSplitter.hasNext()) {
                val componentNameString = colonSplitter.next()
                if (componentNameString.equals(expectedServiceName, ignoreCase = true) ||
                    componentNameString.contains("SosAccessibilityService", ignoreCase = true)
                ) {
                    promise.resolve(true)
                    return
                }
            }
            promise.resolve(false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun startSosAutoConfirm(hospitalName: String, hospitalAddress: String, promise: Promise) {
        try {
            SosAccessibilityService.targetHospitalName = hospitalName
            SosAccessibilityService.targetHospitalAddress = hospitalAddress
            SosAccessibilityService.isSosActive = true
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopSosAutoConfirm(promise: Promise) {
        try {
            SosAccessibilityService.isSosActive = false
            SosAccessibilityService.targetHospitalName = ""
            SosAccessibilityService.targetHospitalAddress = ""
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getCalibrationDump(promise: Promise) {
        try {
            val dump = SosAccessibilityService.calibrationDumpLog.toString()
            promise.resolve(dump)
        } catch (e: Exception) {
            promise.resolve("")
        }
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message)
        }
    }
}

