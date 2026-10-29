package com.sosride.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Hospital(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val address: String? = null,
    val distanceMeters: Double = 0.0,
    val openNow: Boolean? = true,
    val hasEmergencyDepartment: Boolean = true,
    val phone: String? = null,
    val source: String = "Google Places"
) {
    val formattedDistance: String
        get() = if (distanceMeters >= 1000) {
            String.format("%.1f km", distanceMeters / 1000.0)
        } else {
            "${distanceMeters.toInt()} m"
        }
}
