"""Launcher helpers that don't require launching the actual browser."""
import pytest

from invisible_playwright.launcher import (
    InvisiblePlaywright,
    _IANA_TO_POSIX_TZ,
    _tz_env,
    _CHROME_W,
    _CHROME_H,
    _TASKBAR_H,
)


def test_tz_env_known_iana_returns_posix():
    assert _tz_env("America/New_York") == "EST5EDT"
    assert _tz_env("America/Chicago") == "CST6CDT"
    assert _tz_env("America/Los_Angeles") == "PST8PDT"


def test_tz_env_arizona_no_dst():
    """America/Phoenix must NOT have a DST suffix — Arizona doesn't observe DST."""
    assert _tz_env("America/Phoenix") == "MST7"


def test_tz_env_hawaii_no_dst():
    assert _tz_env("Pacific/Honolulu") == "HST10"


def test_tz_env_unknown_iana_passes_through():
    """Linux glibc parses IANA names directly via /usr/share/zoneinfo,
    so unknown zones should fall through unchanged."""
    assert _tz_env("Europe/Berlin") == "Europe/Berlin"
    assert _tz_env("Asia/Tokyo") == "Asia/Tokyo"


def test_iana_to_posix_table_well_formed():
    for iana, posix in _IANA_TO_POSIX_TZ.items():
        assert "/" in iana, f"{iana} is not an IANA zone identifier"
        assert "/" not in posix, f"{posix} should be POSIX format, no slashes"
        assert posix[0].isalpha(), f"{posix} should start with a letter"


def test_chrome_offsets_are_positive_ints():
    """These pad the spoofed viewport to fit inside the spoofed screen.
    Any zero/negative value would let viewport bleed past screen bounds."""
    assert _CHROME_W > 0
    assert _CHROME_H > 0
    assert _TASKBAR_H > 0


def test_invisible_playwright_constructs_without_launching():
    """The class should be instantiable for inspection without entering
    the context manager (which would try to download the binary)."""
    obj = InvisiblePlaywright(seed=42)
    assert obj is not None
    obj2 = InvisiblePlaywright(seed=42, headless=True)
    assert obj2 is not None
