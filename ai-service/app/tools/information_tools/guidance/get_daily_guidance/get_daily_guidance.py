import datetime
import hashlib
from typing import Any

from app.models.chat import ChatRequest
from app.tools.common import AppTool


class GetDailyGuidanceTool(AppTool):
    name = "get_daily_guidance"
    description = (
        "Retrieve a daily spiritual quote, a daily affirmation, a spiritual wellness tip, "
        "and a tailored horoscope check-in based on user's current mood and zodiac sign."
    )
    parameters = {
        "type": "object",
        "properties": {
            "mood": {
                "type": "string",
                "description": "Optional current mood of the user to personalize the guidance (e.g. anxious, stressed, happy, peaceful, distracted).",
            },
            "zodiac_sign": {
                "type": "string",
                "description": "Optional zodiac sign of the user for a tailored spiritual horoscope check-in (e.g. Aries, Taurus, Gemini, etc.).",
            },
            "category": {
                "type": "string",
                "description": "Optional category filter to return specific guidance (e.g. quote, affirmation, horoscope, wellness_tip, all). Defaults to all.",
                "enum": ["quote", "affirmation", "horoscope", "wellness_tip", "all"],
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    # Curated spiritual databases
    QUOTES = [
        {
            "text": "The mind is everything. What you think you become.",
            "author": "Buddha",
            "translation": "मन ही सब कुछ है। जो आप सोचते हैं, वही आप बन जाते हैं।",
        },
        {
            "text": "Arise, awake, and stop not till the goal is reached.",
            "author": "Swami Vivekananda",
            "translation": "उठो, जागो और तब तक मत रुको जब तक लक्ष्य प्राप्त न हो जाए।",
        },
        {
            "text": "You have the right to work, but for the work's sake only. You have no right to the fruits of work.",
            "author": "Bhagavad Gita",
            "translation": "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।",
        },
        {
            "text": "Set your heart on doing good. Do it over and over again, and you will be filled with joy.",
            "author": "Buddha",
            "translation": "अपने दिल को अच्छे कामों में लगाओ। इसे बार-बार करो, और तुम खुशी से भर जाओगे।",
        },
        {
            "text": "Truth can be stated in a thousand different ways, yet each one can be true.",
            "author": "Swami Vivekananda",
            "translation": "सत्य को हजार अलग-अलग तरीकों से कहा जा सकता है, फिर भी हर एक सत्य हो सकता है।",
        },
        {
            "text": "Peace comes from within. Do not seek it without.",
            "author": "Buddha",
            "translation": "शांति भीतर से आती है। इसे बाहर मत ढूंढो।",
        },
        {
            "text": "The only true wisdom is in knowing you know nothing.",
            "author": "Socrates",
            "translation": "एकमात्र सच्चा ज्ञान यह जानने में है कि आप कुछ नहीं जानते।",
        },
        {
            "text": "Be here now.",
            "author": "Ram Dass",
            "translation": "अभी यहीं रहो।",
        },
    ]

    AFFIRMATIONS = [
        "I am aligned with peace, clarity, and purpose.",
        "I welcome positivity, strength, and joy into my life today.",
        "I release all worries and trust the natural flow of life.",
        "My heart is calm, my mind is clear, and my soul is at peace.",
        "I choose gratitude, love, and compassion in every situation.",
        "I possess the strength to overcome any challenge that comes my way.",
        "Every breath I take fills me with peace and confidence.",
        "I am grounded, centered, and fully present in this moment.",
    ]

    WELLNESS_TIPS = [
        "Practice 4-7-8 deep breathing: Inhale for 4s, hold for 7s, exhale for 8s. Repeat 4 times.",
        "Spend 5 minutes in complete silence today. Simply observe your thoughts without judgment.",
        "Drink a warm glass of water and stretch your body for 3 minutes to align your energy.",
        "Write down three things you are deeply grateful for today.",
        "Walk barefoot on grass or connect with nature for 5 minutes.",
        "Take a conscious 2-minute break from all digital screens every hour today.",
        "Do a quick body scan meditation: focus on relaxing your toes, feet, legs, up to your face.",
    ]

    HOROSCOPES = {
        "aries": "A day to direct your vibrant fire inward. Meditation will bring the clarity you seek regarding personal choices.",
        "taurus": "Ground yourself in nature today. Silence will help resolve a minor conflict. Focus on patience and steady breathing.",
        "gemini": "A day of active energy. Before speaking or deciding, take three deep breaths. Align your heart and mind through conscious listening.",
        "cancer": "Your emotional depth is your strength. Sit in quiet contemplation today. Let your thoughts flow like water without holding onto them.",
        "leo": "Your natural light shines brightest when you act with humility. Today is perfect for karma yoga—helping someone without expecting anything in return.",
        "virgo": "Release the need to control every detail. Practice mindfulness in small daily tasks like eating or walking. Trust the universe's flow.",
        "libra": "Balance is your core virtue. Today, balance your output with quiet reflection. A brief afternoon meditation will restore your harmony.",
        "scorpio": "A powerful day for deep transformation. Face your challenges with a calm and stable mind. Let go of past grievances through forgiveness.",
        "sagittarius": "Your quest for truth is highlighted today. Read a few pages of a spiritual text or listen to a wise discourse to inspire your path.",
        "capricorn": "Do not let stress cloud your long-term vision. Dedicate 5 minutes to pranayama (breathing exercises) to release physical tension.",
        "aquarius": "Your vision is broad, but don't forget to connect with your immediate self. Practice grounding yourself in the present moment.",
        "pisces": "Your intuitive waters run deep. Spend time in meditation near quiet spaces. Your quiet moments hold the answers you seek.",
    }

    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        mood = str(arguments.get("mood", "")).strip() or None
        zodiac_sign = str(arguments.get("zodiac_sign", "")).strip().lower() or None
        category = str(arguments.get("category", "all")).strip().lower()

        # Date-based seeding for deterministic rotation per day/mood/zodiac combination
        today_str = datetime.date.today().isoformat()
        
        def get_seeded_index(items_count: int, suffix: str = "") -> int:
            seed_str = f"{today_str}-{suffix}"
            h = hashlib.sha256(seed_str.encode("utf-8")).hexdigest()
            return int(h, 16) % items_count

        quote_idx = get_seeded_index(len(self.QUOTES), f"quote-{mood or ''}")
        affirmation_idx = get_seeded_index(len(self.AFFIRMATIONS), f"affirmation-{mood or ''}")
        tip_idx = get_seeded_index(len(self.WELLNESS_TIPS), f"tip-{mood or ''}")

        quote = self.QUOTES[quote_idx]
        affirmation = self.AFFIRMATIONS[affirmation_idx]
        wellness_tip = self.WELLNESS_TIPS[tip_idx]

        horoscope = None
        if zodiac_sign:
            reading = self.HOROSCOPES.get(zodiac_sign)
            if not reading:
                # Fallback if zodiac sign is misspelled
                reading = "A peaceful day awaits you. Center your mind and focus on the current moment."
            horoscope = {
                "sign": zodiac_sign.capitalize(),
                "reading": reading
            }

        result_data: dict[str, Any] = {}
        summary_parts = []

        if category in ("quote", "all"):
            result_data["quote"] = quote
            summary_parts.append(f"Quote: '{quote['text']}' by {quote['author']}")

        if category in ("affirmation", "all"):
            result_data["affirmation"] = affirmation
            summary_parts.append(f"Affirmation: '{affirmation}'")

        if category in ("wellness_tip", "all"):
            result_data["wellness_tip"] = wellness_tip
            summary_parts.append(f"Wellness Tip: {wellness_tip}")

        if category in ("horoscope", "all") and horoscope:
            result_data["horoscope"] = horoscope
            summary_parts.append(f"Horoscope for {horoscope['sign']}: {horoscope['reading']}")

        # Context details
        if mood:
            result_data["mood"] = mood
        if zodiac_sign:
            result_data["zodiac_sign"] = zodiac_sign.capitalize()

        summary = " | ".join(summary_parts)

        return {
            "success": True,
            "summary": f"Generated daily guidance. {summary}",
            "data": result_data,
        }
