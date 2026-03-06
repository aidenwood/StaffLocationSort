// Pipedrive User Configuration
// Maps Pipedrive user IDs to application users

import { getRegionFullName, normalizeRegionCode } from './regions.js';

export const PIPEDRIVE_USERS = {
  // Test user for safe development and testing
  TEST_USER: {
    id: 23785121, // Aiden Wood's Pipedrive user ID
    name: "Aiden Wood",
    email: "aiden@example.com",
    isTestUser: true,
    region: "Test"
  },
  
  // Production roof inspectors (from Region Roster - 2026)
  INSPECTORS: [
    {
      id: 23088469, // Benjamin Frohloff's Pipedrive user ID
      name: "Benjamin Frohloff",
      firstName: "Benjamin",
      lastName: "Frohloff",
      aliases: ["Ben Frohloff", "Ben F", "Benjamin F"],
      email: "benjamin.frohloff@company.com",
      region: "R09",
      regionName: "R09 - NR (Newcastle/Central Coast/Maitland)",
      location: "FLETCHER, NSW",
      jobTitle: "Roof Inspector",
      appId: 1
    },
    {
      id: 23202649, // Benjamin Wharton's Pipedrive user ID
      name: "Benjamin Wharton", 
      firstName: "Benjamin",
      lastName: "Wharton",
      aliases: ["Ben Wharton", "Ben W", "Benjamin W"],
      email: "benjamin.wharton@company.com",
      region: "R03",
      regionName: "R03 - SC (Sunshine Coast)",
      location: "GOLDEN BEACH, QLD",
      jobTitle: "Roof Inspector",
      appId: 2
    },
    {
      id: 23627480, // Jayden Williams's Pipedrive user ID (mapped from Jayden Dow)
      name: "Jayden Williams",
      firstName: "Jayden", 
      lastName: "Williams",
      email: "jayden.williams@company.com",
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "NEWSTEAD, QLD",
      jobTitle: "Roof Inspector",
      appId: 3
    },
    {
      id: 24226727, // Nick Stevens's Pipedrive user ID
      name: "Nick Stevens",
      firstName: "Nick",
      lastName: "Stevens", 
      email: "nick.stevens@company.com",
      region: "R07",
      regionName: "R07 - GPM (Grafton/Port Macquarie/Coffs Harbour)",
      location: "COPMANHURST, NSW",
      jobTitle: "Roof Inspector",
      appId: 4
    },
    {
      id: 23338136, // Richard Lugert's Pipedrive user ID
      name: "Richard Lugert",
      firstName: "Richard",
      lastName: "Lugert",
      email: "richard.lugert@company.com",
      region: "R04", 
      regionName: "R04 - GT (Gatton/Toowoomba)",
      location: "PRESTON, QLD",
      jobTitle: "Roof Inspector",
      appId: 5
    },
    {
      id: 14469224, // Charlie Staff's Pipedrive user ID (mapped from Charlie Stagg)
      name: "Charlie Staff",
      firstName: "Charlie",
      lastName: "Staff",
      email: "charlie.staff@company.com",
      region: "R05",
      regionName: "R05 - WST (Warwick/Stanthorpe/Texas)",
      location: "WARWICK, QLD", 
      jobTitle: "Sales Consultant / Roof Inspector",
      appId: 6
    },
    {
      id: 15087864, // Tony Punzo's Pipedrive user ID (mapped from Anthony Punzo)
      name: "Tony Punzo",
      firstName: "Tony",
      lastName: "Punzo",
      email: "tony.punzo@company.com",
      region: "R03",
      regionName: "R03 - SC (Sunshine Coast)",
      location: "MOFFAT BEACH, QLD",
      jobTitle: "Sales Consultant/ Roof Inspector", 
      appId: 7
    },
    {
      id: 23140037, // Eric Knutsen's Pipedrive user ID
      name: "Eric Knutsen",
      firstName: "Eric",
      lastName: "Knutsen", 
      email: "eric.knutsen@company.com",
      region: "R08",
      regionName: "R08 - GA (Glen Innes/Armidale/Tamworth)",
      location: "SANDY FLAT, NSW",
      jobTitle: "Sales Representative / Roof Inspector",
      appId: 8
    },
    {
      id: 23337476, // Finlay Coop's Pipedrive user ID
      name: "Finlay Coop",
      firstName: "Finlay",
      lastName: "Coop",
      email: "finlay.coop@company.com",
      region: "R08", 
      regionName: "R08 - GA (Glen Innes/Armidale/Tamworth)",
      location: "ARMIDALE, NSW",
      jobTitle: "Sales Representative/Roof Inspector",
      appId: 9
    },
    {
      id: 23397052, // Tim McGill's Pipedrive user ID
      name: "Tim McGill",
      firstName: "Tim", 
      lastName: "McGill",
      email: "tim.mcgill@company.com",
      region: "R09",
      regionName: "R09 - NR (Newcastle/Central Coast/Maitland)",
      location: "WHITEBRIDGE, NSW",
      jobTitle: "Sales Representative/Roof Inspector",
      appId: 10
    },
    {
      id: 24246032, // Ross Runnalls's Pipedrive user ID
      name: "Ross Runnalls",
      firstName: "Ross",
      lastName: "Runnalls",
      email: "ross.runnalls@company.com",
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "BRISBANE, QLD",
      jobTitle: "Roof Inspector",
      appId: 11
    },
    {
      id: 16757015, // Travis Mills's Pipedrive user ID
      name: "Travis Mills",
      firstName: "Travis",
      lastName: "Mills",
      email: "travis.mills@company.com",
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "BRISBANE, QLD",
      jobTitle: "Roof Inspector",
      appId: 12
    },
    {
      id: 16905119, // Lucas McConnell's Pipedrive user ID
      name: "Lucas McConnell",
      firstName: "Lucas",
      lastName: "McConnell",
      email: "lucas.mcconnell@company.com",
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "BRISBANE, QLD",
      jobTitle: "Roof Inspector",
      appId: 13
    },
    {
      id: 22780018, // Scott Rodman's Pipedrive user ID
      name: "Scott Rodman",
      firstName: "Scott",
      lastName: "Rodman",
      email: "scott.rodman@company.com",
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "BRISBANE, QLD",
      jobTitle: "Roof Inspector",
      appId: 14
    },
    {
      id: 23767114, // Kai Valerio's Pipedrive user ID
      name: "Kai Valerio",
      firstName: "Kai",
      lastName: "Valerio",
      email: "kai.valerio@company.com",
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "BRISBANE, QLD",
      jobTitle: "Roof Inspector",
      appId: 15
    },
    {
      id: 24499879, // Tommy Dennerley's Pipedrive user ID
      name: "Tommy Dennerley",
      firstName: "Tommy",
      lastName: "Dennerley",
      email: "tommy.dennerley@company.com",
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "BRISBANE, QLD",
      jobTitle: "Roof Inspector",
      appId: 16
    },
    {
      id: 24168757, // Ethan Taylor's Pipedrive user ID
      name: "Ethan Taylor",
      firstName: "Ethan",
      lastName: "Taylor",
      email: "ethan.taylor@company.com",
      region: "R01",
      regionName: "R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)",
      location: "BRISBANE, QLD",
      jobTitle: "Roof Inspector",
      appId: 17
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