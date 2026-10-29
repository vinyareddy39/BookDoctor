package com.sosride.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class EmergencyContact(
    val id: String = java.util.UUID.randomUUID().toString(),
    val name: String,
    val phoneNumber: String,
    val isPrimary: Boolean = false
)
