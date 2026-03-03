// Pipedrive User ID Matcher
// Helper script to match your roster with Pipedrive users
// Run this after you have added your API key to find user IDs

import { fetchPipedriveUsers } from '../api/pipedriveRead.js';
import { PIPEDRIVE_USERS } from '../config/pipedriveUsers.js';

// Your roster data from CSV
const ROSTER_DATA = [
  { firstName: "Travis", lastName: "Mills", jobTitle: "Field Operations Manager", region: "R2", location: "NIKENBAH, QLD" },
  { firstName: "Jayden", lastName: "Williams", jobTitle: "Field Sales Representative", region: "", location: "GLEN INNES, NSW" },
  { firstName: "Benjamin", lastName: "Frohloff", jobTitle: "Roof Inspector", region: "", location: "FLETCHER, NSW" },
  { firstName: "Benjamin", lastName: "Wharton", jobTitle: "Roof Inspector", region: "R3", location: "GOLDEN BEACH, QLD" },
  { firstName: "Jayden", lastName: "Dow", jobTitle: "Roof Inspector", region: "R1", location: "NEWSTEAD, QLD" },
  { firstName: "Nicholas", lastName: "Stevens", jobTitle: "Roof Inspector", region: "", location: "COPMANHURST, NSW" },
  { firstName: "Richard", lastName: "Lugert", jobTitle: "Roof Inspector", region: "R4", location: "PRESTON, QLD" },
  { firstName: "Mitch", lastName: "Svensk", jobTitle: "Sales Consultant", region: "", location: "BELMONT, NSW" },
  { firstName: "Charlie", lastName: "Stagg", jobTitle: "Sales Consultant / Roof Inspector", region: "", location: "WARWICK, QLD" },
  { firstName: "Anthony", lastName: "Punzo", jobTitle: "Sales Consultant/ Roof Inspector", region: "R3", location: "MOFFAT BEACH, QLD" },
  { firstName: "Ethan", lastName: "Taylor", jobTitle: "Sales Representative", region: "", location: "MEDOWIE, NSW" },
  { firstName: "Scott", lastName: "Rodman", jobTitle: "Sales Representative", region: "R3", location: "KENILWORTH, QLD" },
  { firstName: "Will", lastName: "van Eyndhoven", jobTitle: "Sales Representative", region: "", location: "GRAFTON, NSW" },
  { firstName: "Owen", lastName: "Telford", jobTitle: "Sales Representative - SEQ", region: "R1", location: "RICHLANDS, QLD" },
  { firstName: "Thomas", lastName: "Dennerley", jobTitle: "Sales Representative - SEQ", region: "R1", location: "LABRADOR, QLD" },
  { firstName: "Eric", lastName: "Knutsen", jobTitle: "Sales Representative / Roof Inspector", region: "", location: "SANDY FLAT, NSW" },
  { firstName: "Finlay", lastName: "Coop", jobTitle: "Sales Representative/Roof Inspector", region: "", location: "ARMIDALE, NSW" },
  { firstName: "Timothy", lastName: "McGill", jobTitle: "Sales Representative/Roof Inspector", region: "", location: "WHITEBRIDGE, NSW" }
];

// Match roster with Pipedrive users
export const matchUsersWithPipedrive = async () => {
  try {
    console.log('🔍 Fetching Pipedrive users...');
    const pipedriveUsers = await fetchPipedriveUsers();
    
    console.log(`📋 Found ${pipedriveUsers.length} users in Pipedrive`);
    
    const matches = [];
    const unmatched = [];
    
    // Try to match each roster member with Pipedrive users
    ROSTER_DATA.forEach(rosterPerson => {
      const fullName = `${rosterPerson.firstName} ${rosterPerson.lastName}`;
      
      // Try exact name match first
      let match = pipedriveUsers.find(user => 
        user.name && user.name.toLowerCase() === fullName.toLowerCase()
      );
      
      // Try first name + last name match
      if (!match) {
        match = pipedriveUsers.find(user => {
          if (!user.name) return false;
          const nameParts = user.name.toLowerCase().split(' ');
          return nameParts.includes(rosterPerson.firstName.toLowerCase()) && 
                 nameParts.includes(rosterPerson.lastName.toLowerCase());
        });
      }
      
      // Try email match (if available)
      if (!match) {
        const expectedEmail = `${rosterPerson.firstName.toLowerCase()}.${rosterPerson.lastName.toLowerCase()}@company.com`;
        match = pipedriveUsers.find(user => 
          user.email && user.email.toLowerCase() === expectedEmail
        );
      }
      
      if (match) {
        matches.push({
          rosterData: rosterPerson,
          pipedriveUser: match,
          confidence: match.name?.toLowerCase() === fullName.toLowerCase() ? 'high' : 'medium'
        });
      } else {
        unmatched.push(rosterPerson);
      }
    });
    
    // Display results
    console.log('\n✅ MATCHED USERS:');
    matches.forEach(match => {
      console.log(`${match.rosterData.firstName} ${match.rosterData.lastName} -> ID: ${match.pipedriveUser.id} (${match.confidence} confidence)`);
      console.log(`   Job: ${match.rosterData.jobTitle} | Region: ${match.rosterData.region} | Pipedrive: ${match.pipedriveUser.name}`);
    });
    
    console.log('\n❌ UNMATCHED USERS:');
    unmatched.forEach(person => {
      console.log(`${person.firstName} ${person.lastName} - ${person.jobTitle}`);
    });
    
    // Generate configuration code for roof inspectors
    console.log('\n🔧 CONFIGURATION FOR ROOF INSPECTORS:');
    const roofInspectors = matches.filter(match => 
      match.rosterData.jobTitle.toLowerCase().includes('roof inspector')
    );
    
    roofInspectors.forEach((match, index) => {
      const person = match.rosterData;
      const user = match.pipedriveUser;
      
      console.log(`{
  id: ${user.id}, // ${person.firstName} ${person.lastName}'s Pipedrive user ID
  name: "${person.firstName} ${person.lastName}",
  firstName: "${person.firstName}",
  lastName: "${person.lastName}",
  email: "${user.email || `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@company.com`}",
  region: "${person.region}",
  location: "${person.location}",
  jobTitle: "${person.jobTitle}",
  appId: ${index + 1}
},`);
    });
    
    return { matches, unmatched, roofInspectors };
    
  } catch (error) {
    console.error('❌ Error matching users:', error.message);
    
    console.log('\n💡 TROUBLESHOOTING:');
    console.log('1. Make sure your VITE_PIPEDRIVE_API_KEY is set in .env');
    console.log('2. Check that your API key has permission to read users');
    console.log('3. Ensure you can connect to Pipedrive API');
    
    return null;
  }
};

// Find specific user by name
export const findUserByName = async (firstName, lastName) => {
  try {
    const pipedriveUsers = await fetchPipedriveUsers();
    const fullName = `${firstName} ${lastName}`;
    
    const matches = pipedriveUsers.filter(user => {
      if (!user.name) return false;
      
      const nameLower = user.name.toLowerCase();
      const fullNameLower = fullName.toLowerCase();
      
      return nameLower.includes(firstName.toLowerCase()) || 
             nameLower.includes(lastName.toLowerCase()) ||
             nameLower === fullNameLower;
    });
    
    console.log(`\n🔍 Searching for: ${fullName}`);
    if (matches.length === 0) {
      console.log('❌ No matches found');
    } else {
      console.log(`✅ Found ${matches.length} possible matches:`);
      matches.forEach(match => {
        console.log(`  ID: ${match.id} | Name: ${match.name} | Email: ${match.email || 'N/A'}`);
      });
    }
    
    return matches;
  } catch (error) {
    console.error('❌ Error searching for user:', error.message);
    return [];
  }
};

// Validate current configuration
export const validateCurrentConfig = async () => {
  try {
    const pipedriveUsers = await fetchPipedriveUsers();
    
    console.log('🔍 Validating current Pipedrive user configuration...');
    
    const validation = {
      testUser: null,
      inspectors: [],
      invalid: []
    };
    
    // Check test user
    const testUser = PIPEDRIVE_USERS.TEST_USER;
    if (testUser.id) {
      const found = pipedriveUsers.find(user => user.id === testUser.id);
      validation.testUser = {
        configured: testUser,
        exists: !!found,
        pipedriveData: found || null
      };
    }
    
    // Check inspectors
    PIPEDRIVE_USERS.INSPECTORS.forEach(inspector => {
      if (inspector.id) {
        const found = pipedriveUsers.find(user => user.id === inspector.id);
        validation.inspectors.push({
          configured: inspector,
          exists: !!found,
          pipedriveData: found || null
        });
        
        if (!found) {
          validation.invalid.push(inspector);
        }
      }
    });
    
    // Display results
    console.log('\n📊 VALIDATION RESULTS:');
    
    if (validation.testUser) {
      console.log(`Test User: ${validation.testUser.exists ? '✅' : '❌'} ${testUser.name} (ID: ${testUser.id})`);
    } else {
      console.log('Test User: ⚠️ Not configured');
    }
    
    console.log(`\nInspectors: ${validation.inspectors.length} configured`);
    validation.inspectors.forEach(inspector => {
      const status = inspector.exists ? '✅' : '❌';
      console.log(`  ${status} ${inspector.configured.name} (ID: ${inspector.configured.id})`);
    });
    
    if (validation.invalid.length > 0) {
      console.log('\n⚠️ INVALID IDs (these users don\'t exist in Pipedrive):');
      validation.invalid.forEach(inspector => {
        console.log(`  ${inspector.name} - ID: ${inspector.id}`);
      });
    }
    
    return validation;
    
  } catch (error) {
    console.error('❌ Error validating configuration:', error.message);
    return null;
  }
};

// Helper to check if Aiden Wood exists in Pipedrive
export const findAidenWood = async () => {
  console.log('🔍 Looking for Aiden Wood in Pipedrive...');
  
  try {
    const matches = await findUserByName('Aiden', 'Wood');
    
    if (matches.length > 0) {
      console.log('\n✅ Found Aiden Wood! Use this ID for the test user:');
      matches.forEach(match => {
        console.log(`
// Update TEST_USER in pipedriveUsers.js:
TEST_USER: {
  id: ${match.id}, // Aiden Wood's Pipedrive user ID
  name: "${match.name}",
  email: "${match.email || 'aiden@company.com'}",
  isTestUser: true,
  region: "Test"
}`);
      });
    } else {
      console.log('❌ Aiden Wood not found in Pipedrive users');
      console.log('💡 You may need to:');
      console.log('1. Add Aiden Wood as a user in Pipedrive');
      console.log('2. Use a different test user');
      console.log('3. Check if the name is spelled differently');
    }
    
    return matches;
  } catch (error) {
    console.error('❌ Error searching for Aiden Wood:', error.message);
    return [];
  }
};