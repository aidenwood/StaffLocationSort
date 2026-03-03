// Pipedrive User Configuration
// Maps Pipedrive user IDs to application users

import { getRegionFullName, normalizeRegionCode } from './regions.js';

export const PIPEDRIVE_USERS = {
  // Test user for safe development and testing
  TEST_USER: {
    id: null, // To be filled with Aiden Wood's Pipedrive user ID
    name: "Aiden Wood",
    email: "aiden@example.com",
    isTestUser: true,
    region: "Test"
  },
  
  // Production roof inspectors (from Region Roster - 2026)
  INSPECTORS: [
    {
      id: null, // To be filled with Benjamin Frohloff's Pipedrive user ID
      name: "Benjamin Frohloff",
      firstName: "Benjamin",
      lastName: "Frohloff",
      email: "benjamin.frohloff@company.com", // Update with actual email
      region: "R09",
      regionName: "R09 - NR (Newcastle/Central Coast/Maitland)",
      location: "FLETCHER, NSW",
      jobTitle: "Roof Inspector",
      appId: 1
    },
    {
      id: null, // To be filled with Benjamin Wharton's Pipedrive user ID
      name: "Benjamin Wharton", 
      firstName: "Benjamin",
      lastName: "Wharton",
      email: "benjamin.wharton@company.com", // Update with actual email
      region: "R03",
      regionName: "R03 - SC (Sunshine Coast)",
      location: "GOLDEN BEACH, QLD",
      jobTitle: "Roof Inspector",
      appId: 2
    },
    {
      id: null, // To be filled with Jayden Dow's Pipedrive user ID
      name: "Jayden Dow",
      firstName: "Jayden", 
      lastName: "Dow",
      email: "jayden.dow@company.com", // Update with actual email
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "NEWSTEAD, QLD",
      jobTitle: "Roof Inspector",
      appId: 3
    },
    {
      id: null, // To be filled with Nicholas Stevens's Pipedrive user ID
      name: "Nicholas Stevens",
      firstName: "Nicholas",
      lastName: "Stevens", 
      email: "nicholas.stevens@company.com", // Update with actual email
      region: "R07",
      regionName: "R07 - GPM (Grafton/Port Macquarie/Coffs Harbour)",
      location: "COPMANHURST, NSW",
      jobTitle: "Roof Inspector",
      appId: 4
    },
    {
      id: null, // To be filled with Richard Lugert's Pipedrive user ID
      name: "Richard Lugert",
      firstName: "Richard",
      lastName: "Lugert",
      email: "richard.lugert@company.com", // Update with actual email
      region: "R04", 
      regionName: "R04 - GT (Gatton/Toowoomba)",
      location: "PRESTON, QLD",
      jobTitle: "Roof Inspector",
      appId: 5
    },
    {
      id: null, // To be filled with Charlie Stagg's Pipedrive user ID
      name: "Charlie Stagg",
      firstName: "Charlie",
      lastName: "Stagg",
      email: "charlie.stagg@company.com", // Update with actual email
      region: "R05",
      regionName: "R05 - WST (Warwick/Stanthorpe/Texas)",
      location: "WARWICK, QLD", 
      jobTitle: "Sales Consultant / Roof Inspector",
      appId: 6
    },
    {
      id: null, // To be filled with Anthony Punzo's Pipedrive user ID
      name: "Anthony Punzo",
      firstName: "Anthony",
      lastName: "Punzo",
      email: "anthony.punzo@company.com", // Update with actual email
      region: "R03",
      regionName: "R03 - SC (Sunshine Coast)",
      location: "MOFFAT BEACH, QLD",
      jobTitle: "Sales Consultant/ Roof Inspector", 
      appId: 7
    },
    {
      id: null, // To be filled with Eric Knutsen's Pipedrive user ID
      name: "Eric Knutsen",
      firstName: "Eric",
      lastName: "Knutsen", 
      email: "eric.knutsen@company.com", // Update with actual email
      region: "R08",
      regionName: "R08 - GA (Glen Innes/Armidale/Tamworth)",
      location: "SANDY FLAT, NSW",
      jobTitle: "Sales Representative / Roof Inspector",
      appId: 8
    },
    {
      id: null, // To be filled with Finlay Coop's Pipedrive user ID
      name: "Finlay Coop",
      firstName: "Finlay",
      lastName: "Coop",
      email: "finlay.coop@company.com", // Update with actual email
      region: "R08", 
      regionName: "R08 - GA (Glen Innes/Armidale/Tamworth)",
      location: "ARMIDALE, NSW",
      jobTitle: "Sales Representative/Roof Inspector",
      appId: 9
    },
    {
      id: null, // To be filled with Timothy McGill's Pipedrive user ID
      name: "Timothy McGill",
      firstName: "Timothy", 
      lastName: "McGill",
      email: "timothy.mcgill@company.com", // Update with actual email
      region: "R09",
      regionName: "R09 - NR (Newcastle/Central Coast/Maitland)",
      location: "WHITEBRIDGE, NSW",
      jobTitle: "Sales Representative/Roof Inspector",
      appId: 10
    }
  ]
};

// Activity types to recognize in Pipedrive
export const PIPEDRIVE_ACTIVITY_TYPES = {
  ROOF_INSPECTION: "Property Inspection", // Base type, inspector name will be appended
  DAY_OFF: "Day Off",
  TRAVELLING: "Travelling to Location",
  FLYING: "Flying",
  LUNCH_BREAK: "Lunch Break" // Optional - usually handled by time slots
};

// Helper functions for user mapping
export const getPipedriveUserById = (pipedriveUserId) => {
  // Check test user first
  if (PIPEDRIVE_USERS.TEST_USER.id === pipedriveUserId) {
    return PIPEDRIVE_USERS.TEST_USER;
  }
  
  // Check inspectors
  return PIPEDRIVE_USERS.INSPECTORS.find(inspector => 
    inspector.id === pipedriveUserId
  );
};

export const getInspectorByAppId = (appId) => {
  return PIPEDRIVE_USERS.INSPECTORS.find(inspector => 
    inspector.appId === appId
  );
};

export const getTestUser = () => {
  return PIPEDRIVE_USERS.TEST_USER;
};

export const getAllInspectors = () => {
  return PIPEDRIVE_USERS.INSPECTORS;
};

export const isTestUser = (pipedriveUserId) => {
  return PIPEDRIVE_USERS.TEST_USER.id === pipedriveUserId;
};

// Validation functions
export const hasValidPipedriveIds = () => {
  const testUserValid = PIPEDRIVE_USERS.TEST_USER.id !== null;
  const inspectorsValid = PIPEDRIVE_USERS.INSPECTORS.every(inspector => 
    inspector.id !== null
  );
  
  return {
    testUser: testUserValid,
    inspectors: inspectorsValid,
    allValid: testUserValid && inspectorsValid
  };
};

export const getInvalidUsers = () => {
  const invalid = [];
  
  if (PIPEDRIVE_USERS.TEST_USER.id === null) {
    invalid.push({ type: 'test', name: PIPEDRIVE_USERS.TEST_USER.name });
  }
  
  PIPEDRIVE_USERS.INSPECTORS.forEach(inspector => {
    if (inspector.id === null) {
      invalid.push({ type: 'inspector', name: inspector.name });
    }
  });
  
  return invalid;
};