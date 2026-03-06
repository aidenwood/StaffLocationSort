// Quick test for name matching logic

// Mock the function from the API file
const checkInspectorNameMatch = (subject, inspectorName, inspectorAliases = []) => {
  if (!subject || !inspectorName) return false;
  
  const normalizedSubject = subject.toLowerCase();
  const normalizedInspectorName = inspectorName.toLowerCase();
  
  // Extract the name part after "Property Inspection - "
  const propertyInspectionPrefix = 'property inspection - ';
  const prefixIndex = normalizedSubject.indexOf(propertyInspectionPrefix);
  
  if (prefixIndex === -1) return false;
  
  const nameInSubject = normalizedSubject.substring(prefixIndex + propertyInspectionPrefix.length).trim();
  
  // Helper function to check one name against the subject
  const checkNameMatch = (name) => {
    const normalizedName = name.toLowerCase();
    
    // 1. Exact match
    if (nameInSubject === normalizedName) return true;
    
    // 2. Full name contains the subject name (e.g., "Ben F" matches "Ben Frohloff")  
    if (normalizedName.includes(nameInSubject)) return true;
    
    // 3. Subject name contains the inspector name (e.g., "Benjamin Wharton" matches "Ben W")
    if (nameInSubject.includes(normalizedName)) return true;
    
    // 4. Check for first name + last initial match (Ben F -> Ben Frohloff)
    const nameParts = normalizedName.split(' ');
    const subjectParts = nameInSubject.split(' ');
    
    if (nameParts.length >= 2 && subjectParts.length >= 2) {
      const firstNameMatch = nameParts[0] === subjectParts[0];
      const lastInitialMatch = nameParts[1].charAt(0) === subjectParts[1].charAt(0);
      if (firstNameMatch && lastInitialMatch) return true;
    }
    
    // 5. Check for first name + partial last name (Ben W -> Benjamin Wharton)
    if (nameParts.length >= 2 && subjectParts.length >= 2) {
      const firstNameSimilar = nameParts[0].startsWith(subjectParts[0]) || subjectParts[0].startsWith(nameParts[0]);
      const lastNameInitial = nameParts[1].charAt(0) === subjectParts[1].charAt(0);
      if (firstNameSimilar && lastNameInitial) return true;
    }
    
    return false;
  };
  
  // Check main name
  if (checkNameMatch(inspectorName)) {
    console.log(`✅ Name match found: "${nameInSubject}" matches main name "${normalizedInspectorName}"`);
    return true;
  }
  
  // Check aliases
  for (const alias of inspectorAliases) {
    if (checkNameMatch(alias)) {
      console.log(`✅ Name match found: "${nameInSubject}" matches alias "${alias.toLowerCase()}"`);
      return true;
    }
  }
  
  console.log(`🔍 Name match attempt: "${nameInSubject}" vs "${normalizedInspectorName}" + ${inspectorAliases.length} aliases - No match`);
  return false;
};

// Test cases based on the screenshot data
console.log('🧪 Testing Enhanced Name Matching\n');

// Benjamin Wharton tests
const benWhartonAliases = ["Ben Wharton", "Ben W", "Benjamin W"];

console.log('--- Benjamin Wharton Tests ---');
console.log('1. Exact match:', checkInspectorNameMatch('Property Inspection - Benjamin Wharton', 'Benjamin Wharton', benWhartonAliases));
console.log('2. Ben W alias:', checkInspectorNameMatch('Property Inspection - Ben W', 'Benjamin Wharton', benWhartonAliases)); 
console.log('3. Ben Wharton alias:', checkInspectorNameMatch('Property Inspection - Ben Wharton', 'Benjamin Wharton', benWhartonAliases));

// Benjamin Frohloff tests
const benFrohloffAliases = ["Ben Frohloff", "Ben F", "Benjamin F"];

console.log('\n--- Benjamin Frohloff Tests ---');
console.log('4. Exact match:', checkInspectorNameMatch('Property Inspection - Benjamin Frohloff', 'Benjamin Frohloff', benFrohloffAliases));
console.log('5. Ben F alias:', checkInspectorNameMatch('Property Inspection - Ben F', 'Benjamin Frohloff', benFrohloffAliases));
console.log('6. Ben Frohloff alias:', checkInspectorNameMatch('Property Inspection - Ben Frohloff', 'Benjamin Frohloff', benFrohloffAliases));

// Other inspector tests (without aliases)
console.log('\n--- Other Inspectors ---');
console.log('7. Charlie:', checkInspectorNameMatch('Property Inspection - Charlie', 'Charlie', []));
console.log('8. Jayden D:', checkInspectorNameMatch('Property Inspection - Jayden D', 'Jayden Williams', ['Jayden D', 'Jayden Dow']));
console.log('9. Nick:', checkInspectorNameMatch('Property Inspection - Nick', 'Nick', []));
console.log('10. Tony:', checkInspectorNameMatch('Property Inspection - Tony', 'Tony', []));

console.log('\n🎯 Testing Complete!');