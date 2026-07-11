import { supabase } from '../lib/supabase';

export async function staffLogin(staffName, pin) {
  if (!supabase) {
    return { error: 'Authentication service not ready. Please refresh the page.' };
  }

  try {
    const { data: staffList, error: fetchError } = await supabase
      .from('staff')
      .select('*')
      .eq('staff_name', staffName);

    if (fetchError) {
      console.error('Error fetching staff:', fetchError);
      return { error: 'Login failed. Please try again.' };
    }

    if (!staffList || staffList.length === 0) {
      return { error: 'Invalid name or PIN' };
    }

    let validStaff = null;
    for (const staff of staffList) {
      if (pin === staff.staff_pin) {
        validStaff = staff;
        break;
      }
    }

    if (!validStaff) {
      return { error: 'Invalid name or PIN' };
    }

    await supabase
      .from('staff')
      .update({ last_login: new Date().toISOString() })
      .eq('id', validStaff.id);

    localStorage.setItem('staff_id', validStaff.id);
    localStorage.setItem('staff_user_id', validStaff.user_id);
    localStorage.setItem('staff_name', validStaff.staff_name);
    localStorage.setItem('staff_restaurant_id', validStaff.user_id);

    return { success: true, staff: validStaff };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
}

export function getStaffSession() {
  const staffId = localStorage.getItem('staff_id');
  const staffUserId = localStorage.getItem('staff_user_id');
  const staffName = localStorage.getItem('staff_name');

  if (!staffId || !staffUserId) {
    return null;
  }

  return {
    staffId,
    staffUserId,
    staffName: staffName || '',
    restaurantId: staffUserId,
  };
}

export function clearStaffSession() {
  localStorage.removeItem('staff_id');
  localStorage.removeItem('staff_user_id');
  localStorage.removeItem('staff_name');
  localStorage.removeItem('staff_restaurant_id');

  const sessionKeys = Object.keys(localStorage).filter((key) => key.startsWith('staff_session_'));
  sessionKeys.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('activeStaffSession');
}
