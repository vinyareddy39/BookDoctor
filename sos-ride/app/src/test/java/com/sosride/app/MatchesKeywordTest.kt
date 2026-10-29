package com.sosride.app

import com.sosride.app.service.SosAccessibilityService
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MatchesKeywordTest {

    @Test
    fun testOkVsBook() {
        // "ok" vs "book" -> should be false
        assertFalse(SosAccessibilityService.matchesKeyword("book", "ok"))
        assertFalse(SosAccessibilityService.matchesKeyword("ok", "book"))
    }

    @Test
    fun testContinueVsContinueWithGoogle() {
        // "continue" vs "Continue with Google" -> exact full-label match required, so false
        assertFalse(SosAccessibilityService.matchesKeyword("Continue with Google", "continue"))
        // Exact label match should succeed
        assertTrue(SosAccessibilityService.matchesKeyword("Continue", "continue"))
    }

    @Test
    fun testConfirmUberGoVsConfirmUberGo() {
        // "confirm ubergo" vs "Confirm UberGo" -> whole-word/phrase match, true
        assertTrue(SosAccessibilityService.matchesKeyword("Confirm UberGo", "confirm ubergo"))
    }

    @Test
    fun testUberGoVsUberGo4Seats() {
        // "ubergo" vs "UberGo, 4 seats" -> whole-word match, true
        assertTrue(SosAccessibilityService.matchesKeyword("UberGo, 4 seats", "ubergo"))
    }
}
