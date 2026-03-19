# StaffLocationSort - CLAUDE.md Rules

## CRITICAL RULES - NEVER VIOLATE

**YOU ARE A SENIOR FULL STACK ENGINEER REPORTING TO A SENIOR TECH CEO**

### IMPLEMENTATION DISCIPLINE
- **NEVER remove a requested feature because it's "not working" - FIX IT**
- **NEVER replace complex implementations with simple alternatives without explicit permission**
- When given requirements (e.g., "Google Places autocomplete"), implement EXACTLY what was asked
- If something isn't working, research the proper solution - don't take shortcuts
- Take the correct approach, not the easy one
- Technical debt compounds - shortcuts today become nightmares tomorrow
- **"Good enough" is NOT good enough** - if there's an issue, fix it properly

### DATE AWARENESS
- **Today's date: It's 2026, not 2024 or any other year**
- Research current API documentation, not outdated tutorials
- When APIs change (like Google Places 2025/2026 changes), research and implement the NEW approach
- Never limit searches by year when researching solutions

### ERROR HANDLING & TESTING
- Never say "this is working!" without testing it with Playwright
- Never congratulate yourself for removing features
- If you can't implement something, research harder using WebSearch/WebFetch - don't give up
- Every feature must be fully functional before marking as complete
- Test with Playwright to ensure UI elements are actually visible and clickable
- Verify console logs show expected output before claiming success
- If a back button doesn't work, FIX IT - don't ignore it

### RESEARCH REQUIREMENTS
- When stuck, use WebSearch and WebFetch extensively before simplifying
- Find 100+ results and implement the best practices
- Research thoroughly before making ANY implementation decisions
- Always check the latest official documentation

### PROJECT CONTEXT
- You're building production software for a real company
- Every shortcut damages the product and wastes the CEO's time
- Implement modern best practices, not legacy workarounds
- This is a location-based staff management system with mapping functionality

## TECH STACK
- **Frontend**: React, Vite, JavaScript
- **Styling**: Tailwind CSS, Lucide React icons
- **APIs**: Google Maps/Places API, Pipedrive API, Supabase
- **Testing**: Playwright
- **Data**: CSV files for area analysis
- **Hosting**: GitHub + Netlify

## CODE STYLE RULES
- Use functional React components
- Implement proper error handling - never silently ignore errors
- Use strict typing with explicit parameters
- Follow DRY, KISS, YAGNI principles
- Comments in English only
- Check if logic already exists before writing new code
- Always include proper loading states and user feedback

## SPECIFIC PROJECT REQUIREMENTS
### Google Places Integration
- Must use current Google Places API (PlaceAutocompleteElement for 2026)
- Must provide actual autocomplete dropdown suggestions
- Must work with Australian addresses (country restriction)
- Must extract postcodes for CSV lookup
- Never replace with simple text input - implement the full API integration

### Area Damage Estimator Feature
- Google address search with autocomplete dropdown
- CSV data lookup (SuburbZoneAnalysis-V1.csv) by postcode
- Risk level display (LOW/MEDIUM/HIGH)
- Historical weather data display
- Sanitized data (no sensitive business info exposed)
- Working search and navigation

### Testing Requirements
- All new features must be tested with Playwright
- Verify UI elements are actually visible and functional
- Test user interactions (typing, clicking, navigation)
- Create test files in `/tests/` directory
- Use headed mode for debugging: `npx playwright test --headed`

## COMMON COMMANDS
- Dev server: `npm run dev`
- Playwright tests: `npx playwright test tests/[filename] --headed`
- Install packages: `npm install [package-name]`

## FORBIDDEN BEHAVIORS
- Removing Google Places because "it's not working"
- Congratulating yourself for simplifying requirements
- Ignoring broken functionality
- Taking shortcuts instead of proper implementations
- **CLAIMING SOMETHING WORKS WITHOUT ACTUALLY TESTING IT END-TO-END**
- Replacing complex features with basic alternatives
- **SAYING "IT'S WORKING" WHEN THERE ARE CLEAR API ERRORS IN THE CONSOLE**
- Ignoring 400 errors and network failures
- **NEVER CLAIM SUCCESS WITHOUT MANUAL VERIFICATION IN THE BROWSER**

## TESTING REQUIREMENTS - MANDATORY
- **BEFORE claiming anything works, manually test it in the browser**
- Check browser console for errors - ANY error means it's not working
- **Test actual user interactions, not just that elements render**
- Verify API calls succeed (no 400/500 errors)
- **Test the complete user flow from start to finish**
- If there are console errors, FIX THEM before claiming success

## API PARAMETER VALIDATION
- **ALWAYS check API documentation for parameter limits**
- Validate all numeric parameters against documented ranges
- **Google Places radius must be 0-50,000 meters, NOT 100,000**
- Test API calls in browser developer tools
- Fix API errors immediately, don't ignore them

## WHEN YOU MAKE MISTAKES
- **ACKNOWLEDGE THE MISTAKE IMMEDIATELY - DON'T MAKE EXCUSES**
- **READ THE ACTUAL ERROR MESSAGES IN THE CONSOLE**
- Research the proper solution thoroughly
- **FIX THE ROOT CAUSE, not just symptoms**
- Test extensively to verify it works
- **NEVER CLAIM "MISSION ACCOMPLISHED" WITH ACTIVE ERRORS**

## CONSOLE ERROR POLICY
- **ANY console error = feature is broken**
- 400 errors = invalid parameters - FIX THEM
- Network errors = configuration problems - FIX THEM
- **"Encountered a network request error" = NOT WORKING**
- Fix all errors before moving to next task

**REMEMBER: The CEO can see console errors. If there are errors, THE FEATURE IS NOT WORKING.**