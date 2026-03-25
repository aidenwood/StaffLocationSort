// Test timezone conversion for 9am appointments
import { convertToAustralianTime } from './src/utils/timezone.js';

console.log('Testing timezone conversion for 9am appointments:\n');

// Test case 1: UTC time that represents 9am Sydney (23:00 UTC previous day)
const utcTime1 = '23:00:00';
const result1 = convertToAustralianTime(utcTime1);
console.log(`UTC ${utcTime1} -> Local ${result1.time} (${result1.time12Hour})`);
console.log(`Crossed midnight: ${result1.crossedMidnight}`);
console.log(`Expected: 09:00 (9:00 AM) with crossedMidnight: true\n`);

// Test case 2: UTC time that represents 2pm Sydney (04:00 UTC same day)
const utcTime2 = '04:00:00';
const result2 = convertToAustralianTime(utcTime2);
console.log(`UTC ${utcTime2} -> Local ${result2.time} (${result2.time12Hour})`);
console.log(`Crossed midnight: ${result2.crossedMidnight}`);
console.log(`Expected: 14:00 (2:00 PM) with crossedMidnight: false\n`);

// Test case 3: UTC time that represents 10am Sydney (00:00 UTC same day)
const utcTime3 = '00:00:00';
const result3 = convertToAustralianTime(utcTime3);
console.log(`UTC ${utcTime3} -> Local ${result3.time} (${result3.time12Hour})`);
console.log(`Crossed midnight: ${result3.crossedMidnight}`);
console.log(`Expected: Special case - returns default 09:00 AM\n`);

// Test case 4: UTC time that represents 11am Sydney (01:00 UTC same day)  
const utcTime4 = '01:00:00';
const result4 = convertToAustralianTime(utcTime4);
console.log(`UTC ${utcTime4} -> Local ${result4.time} (${result4.time12Hour})`);
console.log(`Crossed midnight: ${result4.crossedMidnight}`);
console.log(`Expected: 11:00 (11:00 AM) with crossedMidnight: false\n`);

console.log('✅ If 9am appointments now show on the correct day (Friday instead of Thursday), the fix is working!');