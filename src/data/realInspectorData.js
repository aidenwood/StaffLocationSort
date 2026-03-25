// Real inspector and region data from CSV files

// Region breakdown from CSV with all service areas
export const regionBreakdown = {
  'R01': {
    name: 'R01 - BGCI (Brisbane/Gold Coast/Logan/Ipswich)',
    locations: ['Ipswich', 'Gold Coast', 'Logan', 'Brisbane', 'Beaudesert']
  },
  'R02': {
    name: 'R02 - GM (Gympie/Maryborough)',
    locations: ['Gympie', 'Maryborough', 'Tin Can Bay']
  },
  'R03': {
    name: 'R03 - SC (Sunshine Coast)',
    locations: ['Sunshine Coast', 'Moreton Region']
  },
  'R04': {
    name: 'R04 - GT (Gatton/Toowoomba)',
    locations: ['Gatton', 'Toowoomba', 'Oakey', 'Stanthorpe', 'Tara', 'Warwick', 'Texas']
  },
  'R05': {
    name: 'R05 - WST (Wide Service Territory)',
    locations: ['Emerald', 'Rockhampton', 'Roma']
  },
  'R06': {
    name: 'R06 - RER (Regional East)',
    locations: ['Grafton', 'Port Macquarie', 'Coffs Harbour']
  },
  'R07': {
    name: 'R07 - GPM (Grafton/Port Macquarie)',
    locations: ['Tamworth', 'Armidale', 'Glen Innes']
  },
  'R08': {
    name: 'R08 - GA (Greater Armidale)',
    locations: ['Grafton', 'Port Macquarie', 'Coffs Harbour']
  },
  'R09': {
    name: 'R09 - NR (Newcastle Region)',
    locations: ['Aberglasslyn', 'Rutherford', 'Maitland', 'Newcastle', 'Mereweather', 'Gwandalan', 'Port Stephens', 'Cessnock', 'Lake Macquarie', 'Central Coast']
  },
  'R10': {
    name: 'R10 - SP (Sydney/Penrith)',
    locations: ['Sydney', 'Penrith', 'Parramatta', 'Liverpool', 'Campbelltown', 'Blacktown', 'Camden', 'Richmond', 'Windsor']
  }
};

// Real inspector data from CSV
export const realInspectors = [
  {
    id: 1,
    name: "Travis Mills",
    firstName: "Travis",
    lastName: "Mills",
    email: "travis.mills@company.com",
    active_flag: true,
    phone: "+61 7 4128 1234",
    region: "R02",
    regionName: regionBreakdown.R02.name,
    address: "63 Peppermint Circuit",
    suburb: "NIKENBAH",
    postcode: "4655",
    state: "QLD",
    location: "NIKENBAH, QLD",
    jobTitle: "Field Operations Manager"
  },
  {
    id: 2,
    name: "Jayden Williams",
    firstName: "Jayden",
    lastName: "Williams", 
    email: "jayden.williams@company.com",
    active_flag: true,
    phone: "+61 2 6732 1234",
    region: "R07", // Glen Innes area
    regionName: regionBreakdown.R07.name,
    address: "4 Pitt Street",
    suburb: "GLEN INNES",
    postcode: "2370",
    state: "NSW",
    location: "GLEN INNES, NSW",
    jobTitle: "Field Sales Representative"
  },
  {
    id: 3,
    name: "Benjamin Frohloff",
    firstName: "Benjamin",
    lastName: "Frohloff",
    email: "benjamin.frohloff@company.com",
    active_flag: true,
    phone: "+61 2 4984 1234",
    region: "R09",
    regionName: regionBreakdown.R09.name,
    address: "7 Oregon Avenue",
    suburb: "FLETCHER",
    postcode: "2287",
    state: "NSW",
    location: "FLETCHER, NSW",
    jobTitle: "Roof Inspector"
  },
  {
    id: 4,
    name: "Benjamin Wharton",
    firstName: "Benjamin",
    lastName: "Wharton",
    email: "benjamin.wharton@company.com",
    active_flag: true,
    phone: "+61 7 5492 1234",
    region: "R03",
    regionName: regionBreakdown.R03.name,
    address: "23 Palmer Avenue",
    suburb: "GOLDEN BEACH",
    postcode: "4551",
    state: "QLD",
    location: "GOLDEN BEACH, QLD",
    jobTitle: "Roof Inspector"
  },
  {
    id: 5,
    name: "Jayden Dow",
    firstName: "Jayden",
    lastName: "Dow",
    email: "jayden.dow@company.com",
    active_flag: true,
    phone: "+61 7 3358 1234",
    region: "R01",
    regionName: regionBreakdown.R01.name,
    address: "Unit 108 20 Wyandra Street",
    suburb: "NEWSTEAD",
    postcode: "4006",
    state: "QLD",
    location: "NEWSTEAD, QLD",
    jobTitle: "Roof Inspector"
  },
  {
    id: 6,
    name: "Nicholas Stevens",
    firstName: "Nicholas",
    lastName: "Stevens",
    email: "nicholas.stevens@company.com",
    active_flag: true,
    phone: "+61 2 6644 1234",
    region: "R06",
    regionName: regionBreakdown.R06.name,
    address: "38 Grafton Street",
    suburb: "COPMANHURST",
    postcode: "2460",
    state: "NSW",
    location: "COPMANHURST, NSW",
    jobTitle: "Roof Inspector"
  },
  {
    id: 7,
    name: "Richard Lugert",
    firstName: "Richard",
    lastName: "Lugert",
    email: "richard.lugert@company.com",
    active_flag: true,
    phone: "+61 7 4630 1234",
    region: "R04",
    regionName: regionBreakdown.R04.name,
    address: "1 Gormans Gap Rd",
    suburb: "PRESTON",
    postcode: "4352",
    state: "QLD",
    location: "PRESTON, QLD",
    jobTitle: "Roof Inspector"
  },
  {
    id: 8,
    name: "Mitch Svensk",
    firstName: "Mitch",
    lastName: "Svensk",
    email: "mitch.svensk@company.com",
    active_flag: true,
    phone: "+61 2 4945 1234",
    region: "R09",
    regionName: regionBreakdown.R09.name,
    address: "73 Spinnaker Ridge Way",
    suburb: "BELMONT",
    postcode: "2280",
    state: "NSW",
    location: "BELMONT, NSW",
    jobTitle: "Sales Consultant"
  },
  {
    id: 9,
    name: "Charlie Stagg",
    firstName: "Charlie",
    lastName: "Stagg",
    email: "charlie.stagg@company.com",
    active_flag: true,
    phone: "+61 7 4661 1234",
    region: "R04",
    regionName: regionBreakdown.R04.name,
    address: "134 Grafton Street",
    suburb: "WARWICK",
    postcode: "4370",
    state: "QLD",
    location: "WARWICK, QLD",
    jobTitle: "Sales Consultant / Roof Inspector"
  },
  {
    id: 10,
    name: "Anthony Punzo",
    firstName: "Anthony",
    lastName: "Punzo",
    email: "anthony.punzo@company.com",
    active_flag: true,
    phone: "+61 7 5444 1234",
    region: "R03",
    regionName: regionBreakdown.R03.name,
    address: "202/26 Mcilwraith street",
    suburb: "MOFFAT BEACH",
    postcode: "4551",
    state: "QLD",
    location: "MOFFAT BEACH, QLD",
    jobTitle: "Sales Consultant/ Roof Inspector"
  },
  {
    id: 11,
    name: "Ethan Taylor",
    firstName: "Ethan",
    lastName: "Taylor",
    email: "ethan.taylor@company.com",
    active_flag: true,
    phone: "+61 2 4982 1234",
    region: "R09",
    regionName: regionBreakdown.R09.name,
    address: "65 Casuarina Avenue",
    suburb: "MEDOWIE",
    postcode: "2318",
    state: "NSW",
    location: "MEDOWIE, NSW",
    jobTitle: "Sales Representative"
  },
  {
    id: 12,
    name: "Scott Rodman",
    firstName: "Scott",
    lastName: "Rodman",
    email: "scott.rodman@company.com",
    active_flag: true,
    phone: "+61 7 5446 1234",
    region: "R03",
    regionName: regionBreakdown.R03.name,
    address: "18 Anne Street",
    suburb: "KENILWORTH",
    postcode: "4574",
    state: "QLD",
    location: "KENILWORTH, QLD",
    jobTitle: "Sales Representative"
  },
  {
    id: 13,
    name: "Will van Eyndhoven",
    firstName: "Will",
    lastName: "van Eyndhoven",
    email: "will.vaneyndhoven@company.com",
    active_flag: true,
    phone: "+61 2 6642 1234",
    region: "R06",
    regionName: regionBreakdown.R06.name,
    address: "330 Oliver Street",
    suburb: "GRAFTON",
    postcode: "2460",
    state: "NSW",
    location: "GRAFTON, NSW",
    jobTitle: "Sales Representative"
  },
  {
    id: 14,
    name: "Owen Telford",
    firstName: "Owen",
    lastName: "Telford",
    email: "owen.telford@company.com",
    active_flag: true,
    phone: "+61 7 3345 1234",
    region: "R01",
    regionName: regionBreakdown.R01.name,
    address: "27/145 Government Rd",
    suburb: "RICHLANDS",
    postcode: "4077",
    state: "QLD",
    location: "RICHLANDS, QLD",
    jobTitle: "Sales Representative - SEQ"
  },
  {
    id: 15,
    name: "Thomas Dennerley",
    firstName: "Thomas",
    lastName: "Dennerley",
    email: "thomas.dennerley@company.com",
    active_flag: true,
    phone: "+61 7 5577 1234",
    region: "R01",
    regionName: regionBreakdown.R01.name,
    address: "1/129 Muir street",
    suburb: "LABRADOR",
    postcode: "4215",
    state: "QLD",
    location: "LABRADOR, QLD",
    jobTitle: "Sales Representative - SEQ"
  },
  {
    id: 16,
    name: "Eric Knutsen",
    firstName: "Eric",
    lastName: "Knutsen",
    email: "eric.knutsen@company.com",
    active_flag: true,
    phone: "+61 2 6773 1234",
    region: "R07",
    regionName: regionBreakdown.R07.name,
    address: "7063 New England Hwy",
    suburb: "SANDY FLAT",
    postcode: "2372",
    state: "NSW",
    location: "SANDY FLAT, NSW",
    jobTitle: "Sales Representative / Roof Inspector"
  },
  {
    id: 17,
    name: "Finlay Coop",
    firstName: "Finlay",
    lastName: "Coop",
    email: "finlay.coop@company.com",
    active_flag: true,
    phone: "+61 2 6772 1234",
    region: "R07",
    regionName: regionBreakdown.R07.name,
    address: "100 Barney St",
    suburb: "ARMIDALE",
    postcode: "2350",
    state: "NSW",
    location: "ARMIDALE, NSW",
    jobTitle: "Sales Representative/Roof Inspector"
  },
  {
    id: 18,
    name: "Timothy McGill",
    firstName: "Timothy",
    lastName: "McGill",
    email: "timothy.mcgill@company.com",
    active_flag: true,
    phone: "+61 2 4945 1234",
    region: "R09",
    regionName: regionBreakdown.R09.name,
    address: "2 Kurraka St",
    suburb: "WHITEBRIDGE",
    postcode: "2290",
    state: "NSW",
    location: "WHITEBRIDGE, NSW",
    jobTitle: "Sales Representative/Roof Inspector"
  }
];

// Filter to get only roof inspectors
export const realRoofInspectors = realInspectors.filter(inspector => 
  inspector.jobTitle.toLowerCase().includes('roof inspector')
);