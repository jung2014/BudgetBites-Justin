# BudgetBites
## College Meal Planning Application

BudgetBites is a meal-planning web application designed specifically for college students who want to eat well without draining their wallet. The app helps users generate weekly meal plans and grocery lists that prioritize low-cost ingredients, simple recipes, and minimal cooking equipment for dorm kitchens or shared student apartments.

## Project Overview

BudgetBites addresses the challenge of affordable meal planning for college students and busy professionals. Users can input dietary restrictions, food preferences, cook time preferences, and a weekly budget, and BudgetBites will match them with affordable recipes and meal plans optimized for cost and convenience.

### Key Features
- **User Authentication**: Secure registration and login system with session management
- **Recipe Discovery**: Advanced search and filtering system with integration to Spoonacular API
- **Dietary Preferences**: Support for vegetarian, vegan, gluten-free, and other dietary restrictions
- **Favorites System**: Save and organize favorite recipes
- **Grocery List Generator**: Create consolidated shopping lists from selected recipes
- **Budget Tracking**: Price per serving display and cost estimation
- **Personal Preferences**: Customizable recipe sorting and priority weighting system

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Frontend**: Handlebars templating engine
- **API Integration**: Spoonacular Food API
- **Testing**: Mocha, Chai, Sinon

## Directory Structure

```
BudgetBites/
├── MilestoneSubmissions/          # Project documentation and deliverables
│   ├── Proposal.txt                # Project proposal document
│   ├── Wireframes.md               # Application wireframes
│   ├── UseCase.png                 # Use case diagram
│   ├── BudgetBites_Use_Case_Diagram_FIXED.png
│   ├── ProjectPresentation_2.pdf  # Project presentation
│   ├── UserAcceptanceTesting.md    # UAT report and observations
│   └── ReleaseNotes/               # Version release notes
│       ├── v1.0.0.txt
│       ├── v2.0.0.txt
│       └── v3.0.0.txt
│
├── ProjectSourceCode/              # Main application source code
│   ├── src/                        # Application source files
│   │   ├── index.js                # Application entry point
│   │   ├── app.js                  # Express application setup
│   │   ├── config/                 # Configuration files
│   │   │   ├── db.js               # Database configuration
│   │   │   └── spoonacular.js      # Spoonacular API configuration
│   │   ├── controllers/            # Request handlers for routes
│   │   │   ├── authController.js   # Authentication logic
│   │   │   ├── dashboardController.js
│   │   │   ├── discoverController.js
│   │   │   ├── favoriteController.js
│   │   │   ├── recipeController.js
│   │   │   └── settingsController.js
│   │   ├── middleware/             # Express middleware
│   │   │   └── auth.js             # Authentication middleware
│   │   ├── repositories/           # Data access layer
│   │   │   ├── favoriteRepository.js
│   │   │   ├── preferencesRepository.js
│   │   │   ├── recipeRepository.js
│   │   │   └── userRepository.js
│   │   ├── routes/                 # Route definitions
│   │   │   ├── authRoutes.js
│   │   │   ├── dashboardRoutes.js
│   │   │   ├── discoverRoutes.js
│   │   │   ├── favoriteRoutes.js
│   │   │   ├── recipeRoutes.js
│   │   │   └── settingsRoutes.js
│   │   ├── services/               # Business logic layer
│   │   │   ├── favoriteService.js
│   │   │   ├── preferencesService.js
│   │   │   ├── recipeService.js
│   │   │   └── spoonacularService.js
│   │   ├── utils/                  # Utility functions
│   │   │   ├── navigation.js
│   │   │   ├── strings.js
│   │   │   └── validation.js
│   │   └── lib/                    # Library configurations
│   │       └── handlebars.js      # Handlebars setup
│   │
│   ├── views/                      # Handlebars templates
│   │   ├── layouts/                # Layout templates
│   │   │   └── main.hbs           # Main layout
│   │   ├── pages/                  # Page templates
│   │   │   ├── dashboard.hbs
│   │   │   ├── discover.hbs
│   │   │   ├── favorites.hbs
│   │   │   ├── grocery-list.hbs
│   │   │   ├── login.hbs
│   │   │   ├── logout.hbs
│   │   │   ├── recipe-detail.hbs
│   │   │   ├── register.hbs
│   │   │   └── settings.hbs
│   │   └── partials/               # Reusable template components
│   │       ├── footer.hbs
│   │       ├── head.hbs
│   │       ├── message.hbs
│   │       ├── nav.hbs
│   │       └── title.hbs
│   │
│   ├── public/                     # Static assets
│   │   ├── css/
│   │   │   └── style.css          # Application stylesheet
│   │   └── recipe-images/          # Recipe image assets
│   │       └── custom/            # Custom recipe images
│   │
│   ├── database/                   # Database setup and initialization
│   │   └── init_data/              # SQL scripts and data files
│   │       ├── create.sql          # Database schema
│   │       └── Food Ingredients and Recipe Dataset with Image Name Mapping.csv
│   │
│   ├── scripts/                    # Utility scripts
│   │   └── importCustomRecipes.js  # Custom recipe import script
│   │
│   ├── test/                       # Test files
│   │   └── server.spec.js         # Server and route tests
│   │
│   ├── package.json                # Project dependencies and scripts
│   ├── docker-compose.yaml        # Docker configuration for local development
│   └── node_modules/               # Node.js dependencies (generated)
│
└── TeamMeetingLogs/                # Team collaboration documents
    └── meetingMins.txt             # Team meeting minutes
```

## Run Instructions

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn package manager
- (Optional) Docker and Docker Compose for containerized development

### Environment Variables
Create a `.env` file in the `ProjectSourceCode/` directory with the following variables:

```env
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=budgetbites
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
# OR use DATABASE_URL format:
# DATABASE_URL=postgresql://username:password@localhost:5432/budgetbites

# Session Configuration
SESSION_SECRET=your_random_secret_string_here

# Spoonacular API
SPOONACULAR_API_KEY=your_spoonacular_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Local Development Setup

1. **Navigate to the project source directory:**
   ```bash
   cd ProjectSourceCode
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   - Ensure PostgreSQL is running
   - Create a database named `budgetbites` (or your preferred name)
   - Run the initialization script:
     ```bash
     psql -U your_username -d budgetbites -f database/init_data/create.sql
     ```

4. **Start the development server:**
   ```bash
   npm start
   ```
   This will start the server with nodemon for automatic reloading on file changes.

   The application will be available at `http://localhost:3000`

### Docker Development Setup

1. **Navigate to the project source directory:**
   ```bash
   cd ProjectSourceCode
   ```

2. **Create a `.env` file** with your configuration (see Environment Variables above)

3. **Start the application with Docker Compose:**
   ```bash
   docker-compose up
   ```
   This will start both the PostgreSQL database and the Node.js application in containers.

4. **Access the application:**
   - Application: `http://localhost:3000`
   - Database: `localhost:5432`

### Running Tests

To run the test suite:
```bash
npm test
```

To run tests and then start the server:
```bash
npm run testandrun
```

### Importing Custom Recipes (Optional)

To import custom recipes from a CSV file:
```bash
npm run import:custom
```

Set the following environment variables for custom recipe import:
- `CUSTOM_RECIPE_CSV`: Path to CSV file
- `CUSTOM_RECIPE_IMAGE_SOURCE`: Source directory for images
- `CUSTOM_RECIPE_IMAGE_DEST`: Destination directory for images
- `CUSTOM_RECIPE_IMAGE_URL`: Base URL for images
- `CUSTOM_RECIPE_IMAGE_EXT`: Image file extension (default: `.jpg`)
- `CUSTOM_RECIPE_ID_OFFSET`: ID offset for custom recipes
- `CUSTOM_RECIPE_DEFAULT_SERVINGS`: Default serving size
- `CUSTOM_RECIPE_DRY_RUN=true`: Run without making changes
- `CUSTOM_RECIPE_FORCE=true`: Force import even if recipes exist

## Deployment

### Deploying to Render

The application is configured for deployment on Render. Follow these steps:

1. **Create a Render PostgreSQL instance:**
   - The service automatically exposes `DATABASE_URL`, `DATABASE_INTERNAL_URL`, and `PG*` variables
   - Alternatively, set `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` manually
   - If your database requires SSL, set `DB_SSL=true`

2. **Create a Web Service from this repository:**
   - Use the default build command: `npm install`
   - Set the start command to: `npm run render-start` (for production)
   - Note: `npm start` is reserved for local development with nodemon

3. **Configure environment variables:**
   - `SESSION_SECRET`: Any random string for session encryption
   - Database variables (as described above)
   - `SPOONACULAR_API_KEY`: Your Spoonacular API key for live API calls
     - If not provided, a development key may be used (with rate limits)

4. **Optional: Import custom recipes after deployment:**
   - Set `CUSTOM_RECIPE_CSV` (e.g., `/opt/render/project/src/database/custom.csv`)
   - Run `npm run import:custom` as a one-off job
   - Additional optional overrides available (see Run Instructions above)

### Deployed Application

The application is deployed on Render and accessible at:
**https://budgetbites.onrender.com**

*(Note: If the application is not currently deployed or the URL has changed, please update this section with the current deployment URL.)*

## Team Members

- **Manan Kothari** - Manan-KK - mako1963@colorado.edu
- **Will Gantt** - WillGantt - wiga7071@colorado.edu
- **Justin Nguyen** - jung2014 - jung2014@colorado.edu
- **George Latham** - GeorgeLatham06 - gela2135@colorado.edu

## Additional Resources

- **Wireframes**: See `MilestoneSubmissions/Wireframes.md`
- **Use Case Diagrams**: See `MilestoneSubmissions/UseCase.png` and `BudgetBites_Use_Case_Diagram_FIXED.png`
- **Release Notes**: See `MilestoneSubmissions/ReleaseNotes/`
- **User Acceptance Testing**: See `MilestoneSubmissions/UserAcceptanceTesting.md`

## License

This project is part of a university course assignment.
