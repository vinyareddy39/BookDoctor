package com.sosride.app.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.sosride.app.data.model.EmergencyContact
import org.json.JSONArray
import org.json.JSONObject

class ContactRepository(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("sos_ride_contacts_pref", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_CONTACTS = "emergency_contacts_json"
    }

    fun getContacts(): List<EmergencyContact> {
        val jsonString = prefs.getString(KEY_CONTACTS, null) ?: return emptyList()
        val contacts = mutableListOf<EmergencyContact>()
        try {
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                contacts.add(
                    EmergencyContact(
                        id = obj.optString("id", java.util.UUID.randomUUID().toString()),
                        name = obj.optString("name", "Contact"),
                        phoneNumber = obj.optString("phoneNumber", ""),
                        isPrimary = obj.optBoolean("isPrimary", false)
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return contacts
    }

    fun saveContacts(contacts: List<EmergencyContact>) {
        try {
            val jsonArray = JSONArray()
            contacts.take(5).forEach { contact ->
                val obj = JSONObject()
                obj.put("id", contact.id)
                obj.put("name", contact.name)
                obj.put("phoneNumber", contact.phoneNumber)
                obj.put("isPrimary", contact.isPrimary)
                jsonArray.put(obj)
            }
            prefs.edit().putString(KEY_CONTACTS, jsonArray.toString()).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun addContact(name: String, phone: String) {
        val current = getContacts().toMutableList()
        current.add(EmergencyContact(name = name.trim(), phoneNumber = phone.trim(), isPrimary = current.isEmpty()))
        saveContacts(current)
    }

    fun removeContact(id: String) {
        val current = getContacts().filter { it.id != id }
        saveContacts(current)
    }
}
