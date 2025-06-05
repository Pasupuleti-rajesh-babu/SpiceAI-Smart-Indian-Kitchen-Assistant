# **App Name**: SpiceAI: Smart Indian Kitchen Assistant

## Core Features:

- Home Page: Displays welcome message, instructions, and action buttons for key app functionalities (Generate Recipe, Manage Pantry, Meal Planner, Settings).
- Pantry Manager: Allows users to add, edit, and delete pantry items, with auto-suggestions for expiring items and recipe suggestions based on pantry contents, all stored locally.
- Recipe View: Presents Gemini-generated recipes with titles, ingredients, and step-by-step instructions, including a step-by-step viewer and optional voice navigation.
- AI Meal Planner: Generates a 7-day Indian meal plan based on pantry contents and user goals (e.g., weight loss, high protein), offering smart substitutions. It will use reasoning as a tool in generating the 7-day meal plan, to incorporate constraints or available data, like available ingredients or user goals.
- Settings: Manages preferences, input for Gemini API Key, cuisine preferences, allergies, calorie goals, dark mode, and language settings. Saves everything locally.
- AI Substitution: Recommends healthy, budget-friendly Indian alternatives based on ingredient availability, user history and known nutritional facts. It will use reasoning as a tool to decide the substitute ingredients, so as to preserve a degree of similarity with the intended ingredient.
- AI Query: Understands queries like 'Dinner for 4 with no onion-garlic' and generates appropriate recipes. It will use reasoning as a tool to translate conversational prompts into actionable recipe parameters.
- Mood-Based Recipe Suggestions: Input: “I’m feeling tired” -> Suggests comforting dal chawal or light rasam. Uses Gemini to map emotions -> cuisine styles. Bonus: seasonal comfort foods (rainy day pakoras, winter khichdi)
- Health Goal-to-Meal Translator: Input: “Low GI meal with turmeric and high protein”. Gemini returns recipe with ingredient explanation, nutrition alignment, Goal tags (e.g., 💪 Muscle Recovery, 🧠 Brain Boost)
- AI Portion Calculator: Input: “Dinner for 3 adults and 2 kids”. AI adjusts recipe quantities per serving, dietary needs, and age group. Option to set leftovers or meal prep batch
- Pantry Refill Predictor: Learns how often you use ingredients. Suggests when to restock before it runs out. Uses local history + Gemini to forecast frequency
- Recipe Explain Like I’m 5 (ELI5) Mode: For new cooks or children learning. Simplifies recipe into ultra-basic steps with emojis. Optional toggle: “Cook with Kids Mode”
- Zero-Waste Cooking Mode: Detects leftovers and expiring items. AI creates meals that use everything (e.g., coriander stems, stale roti). Suggests dishes like “Roti Lasagna” or “Masala Rice Scrap Stir Fry”
- Regional Recipe Exploration AI: Ask: “Teach me an authentic Assamese breakfast”. Gemini shares dish, cultural context, language, spice map, serving tips
- Ingredient Storyteller AI: Ask: “What’s the history of saffron in Indian cooking?”. Gemini responds with cultural + culinary stories. Great for food bloggers, educators, or curious cooks
- Reverse Recipe Generator: Upload dish photo or describe what you ate. AI tries to recreate the recipe from scratch. “I had a spicy tomato curry with green peas at my friend’s house…” -> Recipe
- Festive AI Mode: Ask: “Make me a Diwali dinner for 4”. AI builds a themed menu: 2 sweets + 1 main + 1 snack + 1 beverage. All linked to culture, with fusion options too (e.g., Gulab Jamun Tiramisu)

## Style Guidelines:

- Primary color: Saturated orange (#FF8C00) for invoking the warmth and richness of Indian spices.
- Background color: Light desaturated orange (#FAF0E6) for a warm and inviting feel.
- Accent color: Analogous yellow (#D4A272), brighter and more saturated, for buttons and highlights.
- Body: 'PT Sans', a humanist sans-serif for a modern, accessible feel.
- Headline: 'Playfair', a modern sans-serif with a high-end feel; pairs well with PT Sans.
- Use minimalist, flat design icons with rounded corners to match the iOS aesthetic. Icons should represent kitchen tools, ingredients, and dietary preferences.
- Native iOS card style with rounded corners and subtle shadows. Implement an iOS-style bottom navigation bar for easy access to Home, Pantry, Recipes, Cart, and Settings.
- Incorporate a frosted glass effect (similar to Vision OS) for panels, cards, and modal backgrounds to create depth and a modern, immersive experience.
- Subtle, physics-based animations for UI elements (cards, buttons, transitions) to mimic the fluidity and responsiveness of Vision OS.