const {
  getRecipeInformation,
  getRecipePriceBreakdown,
  searchRecipes: searchRecipesFromApi,
  searchRecipesByIngredients: searchRecipesByIngredientsFromApi,
} = require('./spoonacularService');
const recipeRepository = require('../repositories/recipeRepository');
const { stripHtmlTags } = require('../utils/strings');

const parseInteger = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseFloatValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const toCommaSeparatedArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((entry) => `${entry}`.trim()).filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const normalizeDiet = (diet) => {
  if (!diet) {
    return undefined;
  }

  const normalized = diet.toLowerCase().replace(/[-_]+/g, ' ').trim();
  if (normalized === 'none' || normalized.length === 0) {
    return undefined;
  }

  return normalized;
};

const normalizeSearchFilters = (rawFilters = {}) => {
  const normalized = {
    number: Math.min(parseInteger(rawFilters.number) || 10, 100),
    query: (rawFilters.query || '').trim() || undefined,
    diet: normalizeDiet(rawFilters.diet),
    maxReadyTime: parseInteger(rawFilters.maxReadyTime),
    minCalories: parseInteger(rawFilters.minCalories),
    maxCalories: parseInteger(rawFilters.maxCalories),
    minPrice: parseFloatValue(rawFilters.minPrice),
    maxPrice: parseFloatValue(rawFilters.maxPrice),
    intolerances: toCommaSeparatedArray(rawFilters.intolerances).map((entry) => entry.toLowerCase()),
  };

  if (
    normalized.minPrice !== undefined
    && normalized.maxPrice !== undefined
    && normalized.minPrice > normalized.maxPrice
  ) {
    [normalized.minPrice, normalized.maxPrice] = [normalized.maxPrice, normalized.minPrice];
  }

  if (
    normalized.minCalories !== undefined
    && normalized.maxCalories !== undefined
    && normalized.minCalories > normalized.maxCalories
  ) {
    [normalized.minCalories, normalized.maxCalories] = [normalized.maxCalories, normalized.minCalories];
  }

  if (normalized.number < 1) {
    normalized.number = 1;
  }

  return normalized;
};

const normalizeIngredientSearchFilters = (rawFilters = {}) => {
  const baseFilters = normalizeSearchFilters(rawFilters);
  return {
    ...baseFilters,
    ingredients: toCommaSeparatedArray(rawFilters.ingredients || rawFilters.ingredientsList).map((entry) => entry.toLowerCase()),
    ranking: parseInteger(rawFilters.ranking) || undefined,
    ignorePantry:
      typeof rawFilters.ignorePantry === 'string'
        ? rawFilters.ignorePantry !== 'false'
        : rawFilters.ignorePantry !== false,
  };
};

const normalizeApiRecipe = (recipeData = {}) => {
  if (!recipeData || typeof recipeData !== 'object') {
    return null;
  }

  const sanitizedSummary = stripHtmlTags(recipeData.summary);
  let normalizedPrice = null;

  if (recipeData.pricePerServing !== undefined && recipeData.pricePerServing !== null) {
    const numericPrice = Number(recipeData.pricePerServing);
    if (!Number.isNaN(numericPrice)) {
      normalizedPrice = Number((numericPrice / 100).toFixed(2));
    }
  }

  return {
    ...recipeData,
    id: recipeData.id || recipeData.spoonacular_id,
    summary: sanitizedSummary,
    pricePerServing: normalizedPrice,
  };
};

const parseStoredRecipeRow = (row = {}) => {
  if (!row || !row.raw_data) {
    return null;
  }

  let rawData = row.raw_data;
  if (typeof rawData === 'string') {
    try {
      rawData = JSON.parse(rawData);
    } catch (error) {
      console.error('Failed to parse stored recipe JSON:', error.message);
      return null;
    }
  }

  // Check if price needs normalization (if > 100, it's likely in cents)
  let needsPriceNormalization = false;
  if (rawData.pricePerServing !== undefined && rawData.pricePerServing !== null) {
    const price = Number(rawData.pricePerServing);
    if (!Number.isNaN(price) && price > 100) {
      needsPriceNormalization = true;
    }
  }

  const normalized = normalizeApiRecipe(rawData);
  if (!normalized) {
    return null;
  }

  if (!normalized.id) {
    normalized.id = row.spoonacular_id || row.recipe_id;
  }
  
  // Always prefer price_per_serving from database (source of truth)
  // Only use normalized price if database column is not available
  if (row.price_per_serving !== undefined && row.price_per_serving !== null) {
    normalized.pricePerServing = Number(row.price_per_serving);
  } else if (needsPriceNormalization && normalized.pricePerServing !== undefined && normalized.pricePerServing !== null) {
    // Price was normalized, keep it
    // (already normalized by normalizeApiRecipe)
  }
  
  if (!normalized.readyInMinutes && row.ready_in_minutes) {
    normalized.readyInMinutes = row.ready_in_minutes;
  }
  if (!normalized.summary && row.summary) {
    normalized.summary = row.summary;
  }

  return normalized;
};

const getCaloriesFromRecipe = (recipe) => {
  if (!recipe?.nutrition?.nutrients) {
    return null;
  }

  const caloriesEntry = recipe.nutrition.nutrients.find((nutrient) => nutrient?.name === 'Calories');
  if (!caloriesEntry) {
    return null;
  }

  const calories = Number(caloriesEntry.amount);
  return Number.isNaN(calories) ? null : calories;
};

const matchesDietPreference = (recipe, diet) => {
  if (!diet) {
    return true;
  }

  const normalizedDiet = diet.toLowerCase();
  if (!recipe) {
    return false;
  }

  const recipeDiets = Array.isArray(recipe.diets)
    ? recipe.diets.map((entry) => entry.toLowerCase())
    : [];

  if (recipeDiets.includes(normalizedDiet)) {
    return true;
  }

  switch (normalizedDiet) {
    case 'vegetarian':
      return recipe.vegetarian === true;
    case 'vegan':
      return recipe.vegan === true;
    case 'gluten free':
      return recipe.glutenFree === true;
    case 'dairy free':
      return recipe.dairyFree === true;
    case 'low fodmap':
      return recipe.lowFodmap === true;
    case 'whole30':
      return recipe.whole30 === true || recipeDiets.includes('whole30');
    case 'paleo':
      return recipeDiets.includes('paleolithic');
    case 'primal':
      return recipeDiets.includes('primal');
    case 'ketogenic':
      return recipe.ketogenic === true;
    default:
      return recipeDiets.includes(normalizedDiet);
  }
};

const matchesIntolerancePreference = (recipe, intoleranceList = []) => {
  if (!Array.isArray(intoleranceList) || intoleranceList.length === 0) {
    return true;
  }

  const recipeDiets = Array.isArray(recipe?.diets)
    ? recipe.diets.map((entry) => entry.toLowerCase())
    : [];

  return intoleranceList.every((rawIntolerance) => {
    const intolerance = rawIntolerance.trim().toLowerCase();
    if (!intolerance) {
      return true;
    }

    const booleanField = `${intolerance.replace(/\s+/g, '')}Free`;
    if (typeof recipe?.[booleanField] === 'boolean') {
      return recipe[booleanField];
    }

    if (recipeDiets.includes(`${intolerance} free`)) {
      return true;
    }

    // Without explicit metadata, we cannot confidently exclude the recipe.
    return true;
  });
};

const filterRecipesByConstraints = (recipes = [], filters = {}) => {
  return recipes.filter((recipe) => {
    if (!matchesDietPreference(recipe, filters.diet)) {
      return false;
    }

    if (!matchesIntolerancePreference(recipe, filters.intolerances)) {
      return false;
    }

    if (typeof filters.maxReadyTime === 'number') {
      if (typeof recipe.readyInMinutes !== 'number' || recipe.readyInMinutes > filters.maxReadyTime) {
        return false;
      }
    }

    if (typeof filters.minPrice === 'number') {
      if (typeof recipe.pricePerServing !== 'number' || recipe.pricePerServing < filters.minPrice) {
        return false;
      }
    }

    if (typeof filters.maxPrice === 'number') {
      if (typeof recipe.pricePerServing !== 'number' || recipe.pricePerServing > filters.maxPrice) {
        return false;
      }
    }

    const calories = getCaloriesFromRecipe(recipe);
    if (typeof filters.minCalories === 'number' && (calories === null || calories < filters.minCalories)) {
      return false;
    }

    if (typeof filters.maxCalories === 'number' && (calories === null || calories > filters.maxCalories)) {
      return false;
    }

    return true;
  });
};

const recipeHasIngredientCost = (recipe) => {
  if (!recipe || !Array.isArray(recipe.extendedIngredients)) {
    return false;
  }

  return recipe.extendedIngredients.some((ingredient) => {
    const costValue = ingredient?.estimatedCost?.value;
    return typeof costValue === 'number' && !Number.isNaN(costValue);
  });
};

// Helper function to normalize ingredient names for better matching
const normalizeIngredientName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
};

// Helper function to find best matching price for an ingredient
const findMatchingPrice = (ingredient, priceMap) => {
  if (!ingredient) return null;

  // Try exact match first
  const nameKey = normalizeIngredientName(ingredient.name);
  const originalKey = normalizeIngredientName(ingredient.original);
  
  // Try exact match with ingredient name
  if (nameKey && priceMap.has(nameKey)) {
    return priceMap.get(nameKey);
  }
  
  // Try exact match with original text
  if (originalKey && priceMap.has(originalKey)) {
    return priceMap.get(originalKey);
  }
  
  // Try partial matching - check if any price key contains the ingredient name or vice versa
  for (const [priceKey, priceData] of priceMap.entries()) {
    if (nameKey && (priceKey.includes(nameKey) || nameKey.includes(priceKey))) {
      return priceData;
    }
    if (originalKey && (priceKey.includes(originalKey) || originalKey.includes(priceKey))) {
      return priceData;
    }
  }
  
  return null;
};

const applyPriceBreakdownToRecipe = (recipe, priceData) => {
  if (!recipe || !priceData) {
    return recipe;
  }

  if (Array.isArray(recipe.extendedIngredients) && Array.isArray(priceData.ingredients)) {
    const priceMap = new Map();
    priceData.ingredients.forEach((item) => {
      const key = normalizeIngredientName(item.name);
      if (!key) {
        return;
      }
      const numericPrice = Number(item.price);
      if (Number.isNaN(numericPrice) || numericPrice <= 0) {
        return;
      }

      // Store multiple variations of the key for better matching
      priceMap.set(key, {
        price: numericPrice,
        amount: item.amount,
        image: item.image,
      });
      
      // Also store the original name for exact matching
      const originalKey = (item.name || '').trim().toLowerCase();
      if (originalKey && originalKey !== key) {
        priceMap.set(originalKey, {
          price: numericPrice,
          amount: item.amount,
          image: item.image,
        });
      }
    });

    let totalMatchedCost = 0;
    let matchedCount = 0;
    
    recipe.extendedIngredients = recipe.extendedIngredients.map((ingredient) => {
      if (!ingredient) {
        return ingredient;
      }

      const breakdown = findMatchingPrice(ingredient, priceMap);

      if (breakdown) {
        ingredient.estimatedCost = {
          value: breakdown.price,
          unit: 'US Cents',
          amount: breakdown.amount,
          image: breakdown.image,
        };
        totalMatchedCost += breakdown.price;
        matchedCount++;
      }

      return ingredient;
    });

    // Default prices for common ingredients (in cents per typical amount)
    const defaultPrices = {
      'pasta': 50, 'spaghetti': 50, 'linguine': 50, 'penne': 50, 'fettuccine': 50,
      'parmesan cheese': 100, 'parmesan': 100, 'cheese': 80,
      'salt': 1, 'pepper': 2, 'kosher salt': 1, 'black pepper': 2, 'freshly cracked pepper': 2,
      'oregano': 5, 'thyme': 5, 'basil': 8, 'parsley': 5, 'cilantro': 5,
      'red pepper flakes': 3, 'pepper flakes': 3,
      'asparagus': 150, 'onions': 30, 'onion': 30, 'peppers': 40, 'pepper': 40,
      'flour': 10, 'olive oil': 50,
    };

    // Ingredients that should remain free (water, reserved water, etc.)
    const freeIngredients = ['water', 'reserved', 'pasta water', 'reserved pasta water', 'reserved water'];
    
    // Helper to check if ingredient should be free
    const isFreeIngredient = (ingredient) => {
      if (!ingredient) return false;
      const name = normalizeIngredientName(ingredient.name || ingredient.original || '');
      if (!name) return false;
      return freeIngredients.some(free => name.includes(free));
    };

    // Helper to get default price for an ingredient
    const getDefaultPrice = (ingredient) => {
      if (!ingredient || isFreeIngredient(ingredient)) return null;
      const name = normalizeIngredientName(ingredient.name || ingredient.original || '');
      if (!name) return null;
      
      // Check exact match
      if (defaultPrices[name]) {
        return defaultPrices[name];
      }
      
      // Check if name contains any default price key (but avoid false matches)
      for (const [key, price] of Object.entries(defaultPrices)) {
        // Only match if the key is a significant part of the name (at least 3 chars)
        if (key.length >= 3 && (name.includes(key) || key.includes(name))) {
          return price;
        }
      }
      
      return null;
    };

    // If we have totalCost and some ingredients don't have prices, distribute the remainder
    const unmatchedIngredients = recipe.extendedIngredients.filter(
      (ing) => ing && !ing.estimatedCost
    );
    
    if (unmatchedIngredients.length > 0) {
      // First, try to use default prices for common ingredients
      unmatchedIngredients.forEach((ingredient) => {
        if (ingredient && !ingredient.estimatedCost) {
          const defaultPrice = getDefaultPrice(ingredient);
          if (defaultPrice) {
            ingredient.estimatedCost = {
              value: defaultPrice,
              unit: 'US Cents',
              amount: ingredient.amount || 0,
            };
            totalMatchedCost += defaultPrice;
          }
        }
      });

      // Then, if we have totalCost from API, distribute remaining cost
      if (typeof priceData.totalCost === 'number' && priceData.totalCost > 0) {
        const totalCostCents = priceData.totalCost;
        const stillUnmatched = recipe.extendedIngredients.filter(
          (ing) => ing && !ing.estimatedCost
        );
        
        if (stillUnmatched.length > 0 && totalCostCents > totalMatchedCost) {
          const remainingCost = totalCostCents - totalMatchedCost;
          const costPerUnmatched = Math.max(1, Math.floor(remainingCost / stillUnmatched.length));
          
          stillUnmatched.forEach((ingredient) => {
            if (ingredient && !ingredient.estimatedCost) {
              ingredient.estimatedCost = {
                value: costPerUnmatched,
                unit: 'US Cents',
                amount: ingredient.amount || 0,
              };
            }
          });
        }
      } else if (typeof recipe.pricePerServing === 'number' && recipe.pricePerServing > 0 && recipe.servings) {
        // Fallback: use pricePerServing to estimate costs for unmatched ingredients
        // Distribute proportionally based on recipe cost
        const stillUnmatched = recipe.extendedIngredients.filter(
          (ing) => ing && !ing.estimatedCost
        );
        
        if (stillUnmatched.length > 0) {
          // Estimate total recipe cost from pricePerServing
          const totalRecipeCostCents = Math.round(recipe.pricePerServing * recipe.servings * 100);
          const estimatedCostPerIngredient = Math.max(10, Math.floor(totalRecipeCostCents / recipe.extendedIngredients.length));
          
          stillUnmatched.forEach((ingredient) => {
            if (ingredient && !ingredient.estimatedCost) {
              ingredient.estimatedCost = {
                value: estimatedCostPerIngredient,
                unit: 'US Cents',
                amount: ingredient.amount || 0,
              };
            }
          });
        }
      }
    }
  }

  if (typeof priceData.totalCost === 'number') {
    recipe.totalIngredientCost = priceData.totalCost;
  }

  if (typeof priceData.totalCostPerServing === 'number') {
    recipe.totalCostPerServing = priceData.totalCostPerServing;
  }

  recipe.priceBreakdown = priceData;
  return recipe;
};

const saveRecipeToDatabase = async (recipe) => {
  if (!recipe || !recipe.id) {
    return null;
  }

  const payload = {
    spoonacularId: recipe.id,
    title: recipe.title || 'Untitled Recipe',
    description: recipe.summary || recipe.description || null,
    servings: recipe.servings || null,
    sourceUrl: recipe.sourceUrl || null,
    imageUrl: recipe.image || null,
    readyInMinutes: recipe.readyInMinutes || null,
    pricePerServing: typeof recipe.pricePerServing === 'number' ? recipe.pricePerServing : null,
    summary: recipe.summary || null,
    rawData: JSON.stringify(recipe),
  };

  try {
    await recipeRepository.upsertRecipe(payload);
  } catch (error) {
    console.error(`Error saving recipe ${recipe.id} to database:`, error.message || error);
  }

  return recipe;
};

const loadRecipesFromDatabase = async (filters = {}, limit = 20) => {
  try {
    const rows = await recipeRepository.searchStoredRecipes(filters, limit);
    return rows.map(parseStoredRecipeRow).filter((recipe) => Boolean(recipe));
  } catch (error) {
    console.error('Error searching recipes from local cache:', error.message || error);
    return [];
  }
};

const getCachedRecipesMap = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return new Map();
  }

  try {
    const rows = await recipeRepository.findRawRecipesBySpoonacularIds(ids);
    return rows.reduce((acc, row) => {
      if (row.raw_data) {
        let recipe = { ...row.raw_data };
        recipe.id = recipe.id || row.spoonacular_id;
        
        // Always use price_per_serving from database column as source of truth
        if (row.price_per_serving !== undefined && row.price_per_serving !== null) {
          let dbPrice = Number(row.price_per_serving);
          // If price is > 100, it's likely stored in cents (old data), normalize to dollars
          if (!Number.isNaN(dbPrice) && dbPrice > 100) {
            recipe.pricePerServing = Number((dbPrice / 100).toFixed(2));
          } else {
            recipe.pricePerServing = dbPrice;
          }
        } else if (recipe.pricePerServing !== undefined && recipe.pricePerServing !== null) {
          // If no database column, check if raw_data price needs normalization
          // (if > 100, it's likely in cents and needs conversion)
          const price = Number(recipe.pricePerServing);
          if (!Number.isNaN(price) && price > 100) {
            // Price is in cents, normalize to dollars
            recipe.pricePerServing = Number((price / 100).toFixed(2));
          }
          // Otherwise, price is already in dollars, use as-is
        }
        
        acc.set(row.spoonacular_id, recipe);
      }
      return acc;
    }, new Map());
  } catch (error) {
    console.error('Error loading cached recipes:', error.message || error);
    return new Map();
  }
};

const ensureRecipeHasCostData = async (recipe) => {
  if (!recipe || recipeHasIngredientCost(recipe)) {
    return recipe;
  }

  try {
    const priceDataResponse = await getRecipePriceBreakdown(recipe.id);
    const priceData = priceDataResponse?.data;
    if (priceData) {
      const enriched = applyPriceBreakdownToRecipe(recipe, priceData);
      await saveRecipeToDatabase(enriched);
      return enriched;
    }
  } catch (error) {
    console.error(`Error enriching recipe ${recipe?.id} with cost data:`, error.response?.data || error.message);
  }

  return recipe;
};

const fetchRecipeFromApi = async (recipeId) => {
  try {
    const response = await getRecipeInformation(recipeId, { includeNutrition: true });
    let normalizedRecipe = normalizeApiRecipe(response.data);
    if (normalizedRecipe) {
      try {
        const priceResponse = await getRecipePriceBreakdown(recipeId);
        const priceData = priceResponse?.data;
        if (priceData) {
          normalizedRecipe = applyPriceBreakdownToRecipe(normalizedRecipe, priceData);
        }
      } catch (priceError) {
        console.error(`Error fetching price breakdown for recipe ${recipeId}:`, priceError.response?.data || priceError.message);
      }
    }
    if (normalizedRecipe) {
      await saveRecipeToDatabase(normalizedRecipe);
    }
    return normalizedRecipe;
  } catch (error) {
    console.error(`Error fetching recipe ${recipeId}:`, error.response?.data || error.message);
    return null;
  }
};

const getDetailedRecipes = async (recipeIds = []) => {
  if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
    return [];
  }

  const cachedRecipes = await getCachedRecipesMap(recipeIds);
  const missingIds = recipeIds.filter((id) => !cachedRecipes.has(id));

  if (missingIds.length > 0) {
    const fetchedRecipes = await Promise.all(missingIds.map(fetchRecipeFromApi));
    fetchedRecipes.forEach((recipe) => {
      if (recipe && recipe.id) {
        cachedRecipes.set(recipe.id, recipe);
      }
    });
  }

  const orderedRecipes = recipeIds
    .map((id) => cachedRecipes.get(id))
    .filter((recipe) => Boolean(recipe));

  const enrichedRecipes = await Promise.all(
    orderedRecipes.map(async (recipe) => {
      try {
        return await ensureRecipeHasCostData(recipe);
      } catch (error) {
        console.error(`Error ensuring cost data for recipe ${recipe?.id}:`, error.response?.data || error.message);
        return recipe;
      }
    }),
  );

  return enrichedRecipes.filter((recipe) => Boolean(recipe));
};

const fetchRecipesFromApiWithDetails = async (filters, desiredCount) => {
  const requestSize = Math.min(Math.max(desiredCount, filters?.number || 10, 10), 100);
  const params = {
    number: requestSize,
    addRecipeInformation: true,
    addRecipeNutrition: true,
    fillIngredients: true,
  };

  if (filters?.query) {
    params.query = filters.query;
  }
  if (filters?.diet) {
    params.diet = filters.diet;
  }
  if (Array.isArray(filters?.intolerances) && filters.intolerances.length > 0) {
    params.intolerances = filters.intolerances.join(',');
  }
  if (typeof filters?.maxReadyTime === 'number') {
    params.maxReadyTime = filters.maxReadyTime;
  }
  if (typeof filters?.minCalories === 'number') {
    params.minCalories = filters.minCalories;
  }
  if (typeof filters?.maxCalories === 'number') {
    params.maxCalories = filters.maxCalories;
  }

  try {
    const response = await searchRecipesFromApi(params);
    const apiResults = response.data?.results || [];
    if (!Array.isArray(apiResults) || apiResults.length === 0) {
      return [];
    }

    await Promise.all(
      apiResults.map(async (recipe) => {
        const normalized = normalizeApiRecipe(recipe);
        if (normalized) {
          await saveRecipeToDatabase(normalized);
        }
      }),
    );

    const ids = apiResults
      .map((recipe) => recipe.id)
      .filter((id) => Number.isInteger(id));

    if (ids.length === 0) {
      return [];
    }

    return getDetailedRecipes(ids);
  } catch (error) {
    console.error('Error fetching recipes from Spoonacular:', error.response?.data || error.message);
    return [];
  }
};

const fetchRecipesByIngredientsFromApi = async (filters, desiredCount, seenIds = new Set()) => {
  const requestSize = Math.min(Math.max(desiredCount, filters?.number || 10, 5), 100);
  const params = {
    ingredients: (filters?.ingredients || []).join(','),
    number: requestSize,
    ranking: typeof filters?.ranking === 'number' ? filters.ranking : 1,
    ignorePantry: filters?.ignorePantry !== false,
  };

  if (!params.ingredients) {
    return [];
  }

  try {
    const response = await searchRecipesByIngredientsFromApi(params);
    const apiResults = Array.isArray(response.data) ? response.data : [];
    const ids = apiResults
      .map((recipe) => recipe.id)
      .filter((id) => Number.isInteger(id) && !seenIds.has(id));

    if (ids.length === 0) {
      return [];
    }

    return getDetailedRecipes(ids);
  } catch (error) {
    console.error('Error fetching recipes by ingredients:', error.response?.data || error.message);
    return [];
  }
};

const ensureRecipeRecord = async (recipeId) => {
  if (!recipeId) {
    return null;
  }

  let recipeRecord = await recipeRepository.getRecipeRecordId(recipeId);
  if (recipeRecord) {
    return recipeRecord.recipe_id;
  }

  await fetchRecipeFromApi(recipeId);
  recipeRecord = await recipeRepository.getRecipeRecordId(recipeId);

  return recipeRecord ? recipeRecord.recipe_id : null;
};

const buildGroceryList = (recipes = []) => {
  const ingredientMap = new Map();
  let totalEstimatedCost = 0;

  // Default prices for common ingredients (in cents per typical amount)
  const defaultPrices = {
    'pasta': 50, 'spaghetti': 50, 'linguine': 50, 'penne': 50, 'fettuccine': 50,
    'parmesan cheese': 100, 'parmesan': 100, 'cheese': 80,
    'salt': 1, 'pepper': 2, 'kosher salt': 1, 'black pepper': 2, 'freshly cracked pepper': 2,
    'oregano': 5, 'thyme': 5, 'basil': 8, 'parsley': 5, 'cilantro': 5, 'flat-leaf parsley': 5,
    'red pepper flakes': 3, 'pepper flakes': 3,
    'asparagus': 150, 'onions': 30, 'onion': 30, 'peppers': 40, 'pepper': 40,
    'flour': 10, 'olive oil': 50,
  };

  // Ingredients that should remain free
  const freeIngredients = ['water', 'reserved', 'pasta water', 'reserved pasta water', 'reserved water'];

  // Helper to get default price for an ingredient name
  const getDefaultPrice = (name) => {
    if (!name) return null;
    const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Check if it's a free ingredient
    if (freeIngredients.some(free => normalized.includes(free))) {
      return 0;
    }
    
    // Check exact match
    if (defaultPrices[normalized]) {
      return defaultPrices[normalized];
    }
    
    // Check if name contains any default price key (at least 3 chars)
    for (const [key, price] of Object.entries(defaultPrices)) {
      if (key.length >= 3 && (normalized.includes(key) || key.includes(normalized))) {
        return price;
      }
    }
    
    return null;
  };

  recipes.forEach((recipe) => {
    if (!recipe || !recipe.extendedIngredients) return;

    recipe.extendedIngredients.forEach((ingredient) => {
      const resolvedName = (ingredient.name || ingredient.original || '').trim();
      if (!resolvedName) {
        return;
      }

      const key = resolvedName.toLowerCase();
      
      // Get cost from ingredient, or apply default price if missing
      let cost = 0;
      if (ingredient.estimatedCost?.value) {
        cost = ingredient.estimatedCost.value / 100;
      } else {
        // Apply default price if available
        const defaultPriceCents = getDefaultPrice(resolvedName);
        if (defaultPriceCents !== null) {
          cost = defaultPriceCents / 100;
        }
      }
      
      totalEstimatedCost += cost;

      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key);
        existing.amount += ingredient.amount || 0;
        existing.recipes.push(recipe.title);
        if (cost > 0) {
          const previousCost = parseFloat(existing.estimatedCost) || 0;
          existing.estimatedCost = (previousCost + cost).toFixed(2);
        }
      } else {
        ingredientMap.set(key, {
          id: ingredient.id,
          name: ingredient.name || resolvedName,
          original: ingredient.original,
          amount: ingredient.amount || 0,
          unit: ingredient.unit || '',
          aisle: ingredient.aisle || 'Unknown',
          image: ingredient.image,
          estimatedCost: cost.toFixed(2),
          recipes: [recipe.title],
        });
      }
    });
  });

  const groceryList = Array.from(ingredientMap.values());
  groceryList.sort((a, b) => {
    if (a.aisle < b.aisle) return -1;
    if (a.aisle > b.aisle) return 1;
    return 0;
  });

  const groupedByAisle = {};
  groceryList.forEach((item) => {
    const aisle = item.aisle || 'Unknown';
    if (!groupedByAisle[aisle]) {
      groupedByAisle[aisle] = [];
    }
    groupedByAisle[aisle].push(item);
  });

  return {
    groceryList,
    groupedByAisle,
    totalEstimatedCost: totalEstimatedCost.toFixed(2),
  };
};

const sortRecipesByPreferences = (recipes, preferences) => {
  if (!recipes || recipes.length === 0) return recipes;
  if (!preferences) return recipes;

  const sorted = [...recipes];
  const sortBy = preferences.sort_by || 'relevance';
  const sortOrder = preferences.sort_order || 'asc';
  const isAscending = sortOrder === 'asc';

  const calculateScore = (recipe) => {
    const factors = preferences.priority_factors || { price: 1, time: 1, calories: 1, health: 1 };
    let score = 0;

    if (recipe.pricePerServing && factors.price) {
      score += (100 - (recipe.pricePerServing * 10)) * factors.price;
    }

    if (recipe.readyInMinutes && factors.time) {
      score += (100 - recipe.readyInMinutes) * factors.time;
    }

    if (recipe.nutrition?.nutrients) {
      const calories = recipe.nutrition.nutrients.find((n) => n.name === 'Calories');
      if (calories && factors.calories) {
        score += (calories.amount / 10) * factors.calories;
      }
    }

    if (recipe.healthScore && factors.health) {
      score += recipe.healthScore * factors.health;
    }

    return score;
  };

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'price': {
        const priceA = a.pricePerServing || Infinity;
        const priceB = b.pricePerServing || Infinity;
        comparison = priceA - priceB;
        break;
      }
      case 'time': {
        const timeA = a.readyInMinutes || Infinity;
        const timeB = b.readyInMinutes || Infinity;
        comparison = timeA - timeB;
        break;
      }
      case 'calories': {
        const calA = a.nutrition?.nutrients?.find((n) => n.name === 'Calories')?.amount || 0;
        const calB = b.nutrition?.nutrients?.find((n) => n.name === 'Calories')?.amount || 0;
        comparison = calA - calB;
        break;
      }
      case 'health': {
        const healthA = a.healthScore || 0;
        const healthB = b.healthScore || 0;
        comparison = healthB - healthA;
        break;
      }
      case 'popularity': {
        const popA = a.aggregateLikes || 0;
        const popB = b.aggregateLikes || 0;
        comparison = popB - popA;
        break;
      }
      case 'relevance':
      default:
        comparison = calculateScore(b) - calculateScore(a);
        break;
    }

    return isAscending ? comparison : -comparison;
  });

  return sorted;
};

const searchRecipesWithFallback = async (rawFilters = {}) => {
  const filters = normalizeSearchFilters(rawFilters);
  const localFetchLimit = Math.min(filters.number * 3, 90);
  const localRecipes = await loadRecipesFromDatabase(filters, localFetchLimit);
  const filteredLocal = filterRecipesByConstraints(localRecipes, filters);

  const results = [];
  const seenIds = new Set();

  filteredLocal.forEach((recipe) => {
    if (recipe && recipe.id && !seenIds.has(recipe.id)) {
      seenIds.add(recipe.id);
      results.push(recipe);
    }
  });

  if (results.length < filters.number) {
    const needed = filters.number - results.length;
    const apiRecipes = await fetchRecipesFromApiWithDetails(filters, Math.max(needed * 2, needed));
    const filteredApi = filterRecipesByConstraints(apiRecipes, filters);

    filteredApi.forEach((recipe) => {
      if (recipe && recipe.id && !seenIds.has(recipe.id)) {
        seenIds.add(recipe.id);
        results.push(recipe);
      }
    });
  }

  return results.slice(0, filters.number);
};

const searchRecipesByIngredientsWithFallback = async (rawFilters = {}) => {
  const filters = normalizeIngredientSearchFilters(rawFilters);
  if (!filters.ingredients || filters.ingredients.length === 0) {
    return [];
  }

  const localFilters = {
    ...filters,
    ingredients: filters.ingredients,
  };

  const localFetchLimit = Math.min(filters.number * 3, 90);
  const localRecipes = await loadRecipesFromDatabase(localFilters, localFetchLimit);
  const filteredLocal = filterRecipesByConstraints(localRecipes, filters);

  const results = [];
  const seenIds = new Set();

  filteredLocal.forEach((recipe) => {
    if (recipe && recipe.id && !seenIds.has(recipe.id)) {
      seenIds.add(recipe.id);
      results.push(recipe);
    }
  });

  if (results.length < filters.number) {
    const needed = filters.number - results.length;
    const apiRecipes = await fetchRecipesByIngredientsFromApi(filters, Math.max(needed * 2, needed), seenIds);
    const filteredApi = filterRecipesByConstraints(apiRecipes, filters);
    filteredApi.forEach((recipe) => {
      if (recipe && recipe.id && !seenIds.has(recipe.id)) {
        seenIds.add(recipe.id);
        results.push(recipe);
      }
    });
  }

  return results.slice(0, filters.number);
};

module.exports = {
  normalizeApiRecipe,
  applyPriceBreakdownToRecipe,
  saveRecipeToDatabase,
  getDetailedRecipes,
  ensureRecipeRecord,
  buildGroceryList,
  sortRecipesByPreferences,
  searchRecipesWithFallback,
  searchRecipesByIngredientsWithFallback,
};
