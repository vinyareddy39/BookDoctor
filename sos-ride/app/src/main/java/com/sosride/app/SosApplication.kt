package com.sosride.app

import android.app.Application
import android.util.Log

class SosApplication : Application() {

    companion object {
        lateinit var instance: SosApplication
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i("SosApplication", "SOS Ride Application initialized")
    }
}
