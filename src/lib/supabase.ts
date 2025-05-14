import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qhsguodtwbqqqfxgtups.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoc2d1b2R0d2JxcXFmeGd0dXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQ1MDMsImV4cCI6MjA2MjgxMDUwM30.GiJCjG3JhBxknz8AqP2csfDdkjdAf0nyekjVJKP3xD8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

// Function to insert 10 sample users if they don't exist
export async function insertSampleUsers() {
  const sampleUsers = [
    { name: 'John Doe', email: 'john.doe@example.com' },
    { name: 'Jane Smith', email: 'jane.smith@example.com' },
    { name: 'Michael Johnson', email: 'michael.johnson@example.com' },
    { name: 'Emily Davis', email: 'emily.davis@example.com' },
    { name: 'Robert Wilson', email: 'robert.wilson@example.com' },
    { name: 'Sarah Brown', email: 'sarah.brown@example.com' },
    { name: 'David Miller', email: 'david.miller@example.com' },
    { name: 'Jennifer Taylor', email: 'jennifer.taylor@example.com' },
    { name: 'James Anderson', email: 'james.anderson@example.com' },
    { name: 'Lisa Thomas', email: 'lisa.thomas@example.com' }
  ];

  // Check if users already exist
  const { data: existingUsers } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  // If no users exist, insert sample users
  if (!existingUsers || existingUsers.length === 0) {
    await supabase.from('users').insert(sampleUsers);
  }
}

// Function to get all users
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data || [];
} 