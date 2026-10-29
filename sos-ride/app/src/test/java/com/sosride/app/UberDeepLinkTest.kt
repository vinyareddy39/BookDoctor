package com.sosride.app

import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.URLEncoder

class UberDeepLinkTest {

    @Test
    fun testDeepLinkUriFormat() {
        val lat = 17.4325
        val lng = 78.4072
        val hLat = 17.4398
        val hLng = 78.4123
        val hName = "Apollo Emergency Hospital"

        val encodedName = URLEncoder.encode(hName, "UTF-8")
        val queryParams = "action=setPickup" +
                "&pickup[latitude]=$lat" +
                "&pickup[longitude]=$lng" +
                "&dropoff[latitude]=$hLat" +
                "&dropoff[longitude]=$hLng" +
                "&dropoff[nickname]=$encodedName"

        val nativeUri = "uber://?$queryParams"
        val webFallbackUri = "https://m.uber.com/ul/?$queryParams"

        assertTrue(nativeUri.startsWith("uber://?action=setPickup"))
        assertTrue(nativeUri.contains("pickup[latitude]=17.4325"))
        assertTrue(nativeUri.contains("dropoff[nickname]=Apollo+Emergency+Hospital"))

        assertTrue(webFallbackUri.startsWith("https://m.uber.com/ul/?action=setPickup"))
    }
}
