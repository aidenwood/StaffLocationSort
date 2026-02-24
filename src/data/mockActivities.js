// Mock data matching Pipedrive Activities API format
// Logan, QLD area coordinates and addresses

export const inspectors = [
  {
    id: 1,
    name: "Ross Mitchell",
    email: "ross@inspections.com.au",
    active_flag: true,
    phone: "+61 7 3123 4567",
    region: "Logan Central"
  },
  {
    id: 2,
    name: "Ben Thompson",
    email: "ben@inspections.com.au", 
    active_flag: true,
    phone: "+61 7 3123 4568",
    region: "Logan"
  },
  {
    id: 3,
    name: "Jayden Wilson",
    email: "jayden@inspections.com.au",
    active_flag: true,
    phone: "+61 7 3123 4569",
    region: "Beenleigh"
  }
];

export const activityTypes = [
  {
    id: 1,
    name: "Roof Inspection - Hail Damage",
    key_string: "roof_inspection",
    icon_key: "home",
    color: "blue",
    order_nr: 1,
    active_flag: true
  }
];

// Logan QLD area locations
export const loganLocations = [
  { address: "123 Main St, Logan Central QLD 4114", lat: -27.6378, lng: 153.1094 },
  { address: "45 Kingston Rd, Woodridge QLD 4114", lat: -27.6245, lng: 153.1089 },
  { address: "78 Wembley Rd, Logan Central QLD 4114", lat: -27.6398, lng: 153.1134 },
  { address: "156 Pacific Hwy, Loganholme QLD 4129", lat: -27.6789, lng: 153.2012 },
  { address: "234 Beaudesert Rd, Moorooka QLD 4105", lat: -27.5234, lng: 153.0567 },
  { address: "89 Springwood Rd, Springwood QLD 4127", lat: -27.6334, lng: 153.1289 },
  { address: "167 Logan River Rd, Beenleigh QLD 4207", lat: -27.7156, lng: 153.2034 },
  { address: "91 Browns Plains Rd, Browns Plains QLD 4118", lat: -27.6567, lng: 153.0789 },
  { address: "203 Chambers Flat Rd, Park Ridge QLD 4125", lat: -27.7234, lng: 153.0456 },
  { address: "145 Marsden Rd, Marsden QLD 4132", lat: -27.6645, lng: 153.1023 }
];

// Generate activities for today and next 7 days
export const generateMockActivities = () => {
  const activities = [];
  const today = new Date();
  
  
  // Generate activities for each inspector over the next 7 days
  inspectors.forEach((inspector, inspectorIndex) => {
    for (let day = 0; day < 7; day++) {
      const activityDate = new Date(today);
      activityDate.setDate(today.getDate() + day);
      
      // Generate 3-5 activities per inspector per day (avoiding lunch hour)
      const activitiesPerDay = 3 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < activitiesPerDay; i++) {
        const location = loganLocations[Math.floor(Math.random() * loganLocations.length)];
        const activityType = activityTypes[0]; // Only roof inspections now
        
        // Generate time slots (9 AM to 4 PM, avoiding lunch 12-1 PM)
        let hour, minute;
        do {
          hour = 9 + Math.floor(Math.random() * 7);
          minute = Math.random() > 0.5 ? 0 : 30;
        } while (hour === 12); // Avoid lunch hour
        
        const dueDateTime = new Date(activityDate);
        dueDateTime.setHours(hour, minute, 0, 0);
        
        const activity = {
          id: activities.length + 1,
          company_id: 12345,
          owner_id: inspector.id, // Pipedrive v2 uses owner_id
          creator_user_id: inspector.id,
          is_deleted: false,
          done: day < 0, // Past activities are done
          type: activityType.key_string,
          conference_meeting_client: null,
          conference_meeting_url: null,
          conference_meeting_id: null,
          due_date: dueDateTime.toISOString().split('T')[0],
          due_time: dueDateTime.toTimeString().split(' ')[0].substring(0, 8), // HH:MM:SS format
          duration: "01:00:00", // Default 1 hour for roof inspections
          busy: true, // Pipedrive v2 uses 'busy' not 'busy_flag'
          add_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          marked_as_done_time: day < 0 ? new Date(dueDateTime.getTime() + 2 * 60 * 60 * 1000).toISOString() : null,
          subject: `${activityType.name} - ${location.address.split(',')[0]}`,
          public_description: `Professional ${activityType.name.toLowerCase()} for property at ${location.address}`,
          note: Math.random() > 0.7 ? "Client requested early morning appointment" : null,
          priority: Math.floor(Math.random() * 3) + 1, // 1-3 priority level
          // Location object structure matching Pipedrive API
          location: {
            value: location.address,
            country: "Australia", 
            admin_area_level_1: "Queensland",
            admin_area_level_2: null,
            locality: location.address.split(' QLD ')[0].split(', ').pop(),
            sublocality: null,
            route: location.address.split(' ').slice(1, -3).join(' '),
            street_number: location.address.split(' ')[0],
            subpremise: null,
            postal_code: location.address.match(/QLD (\d{4})/)?.[1] || "4114"
          },
          // Add coordinates for map visualization
          location_lat: location.lat,
          location_lng: location.lng,
          org_id: Math.floor(Math.random() * 1000) + 1,
          person_id: Math.floor(Math.random() * 1000) + 1,
          deal_id: Math.floor(Math.random() * 1000) + 1,
          lead_id: `lead-${Math.random().toString(36).substr(2, 9)}`,
          project_id: null,
          // Attendees array matching Pipedrive structure
          attendees: [
            {
              person_id: Math.floor(Math.random() * 1000) + 1,
              primary: true,
              email: `client${Math.floor(Math.random() * 1000)}@example.com`,
              name: `${["John", "Sarah", "Mike", "Emma", "David"][Math.floor(Math.random() * 5)]} ${["Smith", "Johnson", "Brown", "Wilson", "Taylor"][Math.floor(Math.random() * 5)]}`,
              status: "accepted",
              is_organizer: false
            }
          ],
          // Custom fields for roof inspection details  
          roof_type: ["Metal Roof", "Decramastic roof tiles", "Asbestos roof", "Mixed"][Math.floor(Math.random() * 4)],
          property_type: ["House", "Unit", "Townhouse"][Math.floor(Math.random() * 3)],
          inspection_fee: 350, // Standard roof inspection fee
          client_contact: `+61 4${Math.floor(Math.random() * 90000000) + 10000000}`,
          special_instructions: Math.random() > 0.7 ? "Focus on north-facing section, visible hail damage" : null,
          // Additional Pipedrive fields
          source_timezone: "Australia/Brisbane"
        };
        
        activities.push(activity);
      }
    }
  });
  
  // Sort activities by date and time
  activities.sort((a, b) => {
    const dateA = new Date(`${a.due_date}T${a.due_time}`);
    const dateB = new Date(`${b.due_date}T${b.due_time}`);
    return dateA - dateB;
  });
  
  return activities;
};

export const mockActivities = generateMockActivities();


// Helper functions for the UI
export const getActivitiesByInspector = (inspectorId) => {
  return mockActivities.filter(activity => activity.owner_id === inspectorId);
};

export const getActivitiesByDate = (date) => {
  const dateString = date.toISOString().split('T')[0];
  return mockActivities.filter(activity => activity.due_date === dateString);
};

export const getActivitiesByInspectorAndDate = (inspectorId, date) => {
  const dateString = date.toISOString().split('T')[0];
  const filtered = mockActivities.filter(
    activity => activity.owner_id === inspectorId && activity.due_date === dateString
  );
  
  
  return filtered;
};

export const getInspectorById = (id) => {
  return inspectors.find(inspector => inspector.id === id);
};

export const getActivityTypeByKey = (keyString) => {
  return activityTypes.find(type => type.key_string === keyString);
};