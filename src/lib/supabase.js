import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase configuration missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    enabled: true,
  }
});

// Helper functions for roster management
export const rosterApi = {
  // Get roster data for a date range
  async getRosterData(startDate, endDate, inspectorId = null) {
    try {
      let query = supabase
        .from('inspector_roster')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      
      if (inspectorId) {
        query = query.eq('inspector_id', inspectorId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching roster data:', error);
      return [];
    }
  },

  // Update roster assignment for an inspector on a specific date
  async updateRosterAssignment(inspectorId, inspectorName, date, regionCode, regionName, status = 'working', notes = '') {
    try {
      const { data, error } = await supabase
        .from('inspector_roster')
        .upsert(
          {
            inspector_id: inspectorId,
            inspector_name: inspectorName,
            date,
            region_code: regionCode,
            region_name: regionName,
            status,
            notes,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'inspector_id,date',
            ignoreDuplicates: false,
          }
        )
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating roster assignment:', error);
      return { success: false, error: error.message };
    }
  },

  // Bulk update roster assignments
  async bulkUpdateRoster(assignments) {
    try {
      const { data, error } = await supabase
        .from('inspector_roster')
        .upsert(assignments, {
          onConflict: 'inspector_id,date',
          ignoreDuplicates: false,
        })
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error bulk updating roster:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete roster assignment
  async deleteRosterAssignment(inspectorId, date) {
    try {
      const { error } = await supabase
        .from('inspector_roster')
        .delete()
        .eq('inspector_id', inspectorId)
        .eq('date', date);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting roster assignment:', error);
      return { success: false, error: error.message };
    }
  },

  // Subscribe to roster changes
  subscribeToRosterChanges(callback) {
    const subscription = supabase
      .channel('roster_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'inspector_roster' 
        }, 
        callback
      )
      .subscribe();

    return subscription;
  },

  // Unsubscribe from changes
  unsubscribeFromRosterChanges(subscription) {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
};

export default supabase;