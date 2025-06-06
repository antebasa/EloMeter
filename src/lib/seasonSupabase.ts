import { supabase } from '../supabaseClient';
import type { TeamWithStats, User } from './supabase';

// Season interfaces
export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date?: string;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
}

export interface SeasonTeam {
  id: number;
  season_id: number;
  team_id: number;
  created_at: string;
  team?: {
    id: number;
    name: string;
    player_defense_id: number;
    player_offense_id: number;
  };
}

export interface SeasonFixture {
  id: number;
  season_id: number;
  home_team_id: number;
  away_team_id: number;
  home_score?: number;
  away_score?: number;
  played_at?: string;
  created_at: string;
  home_team?: {
    id: number;
    name: string;
    player_defense_id: number;
    player_offense_id: number;
  };
  away_team?: {
    id: number;
    name: string;
    player_defense_id: number;
    player_offense_id: number;
  };
}

export interface SeasonStanding {
  team_id: number;
  team_name: string;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;  
  matches_lost: number;
  goals_scored: number;
  goals_conceded: number;
  goal_difference: number;
  points: number;
}

// Get all seasons
export async function getSeasons(): Promise<Season[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching seasons:', error);
    return [];
  }
  return data || [];
}

// Get active season
export async function getActiveSeason(): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('status', 'active')
    .single();

  if (error) {
    console.error('Error fetching active season:', error);
    return null;
  }
  return data;
}

// Create new season
export async function createSeason(name: string, startDate: string): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .insert({
      name,
      start_date: startDate,
      status: 'draft'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating season:', error);
    return null;
  }
  return data;
}

// Update season status
export async function updateSeasonStatus(seasonId: number, status: 'draft' | 'active' | 'completed'): Promise<boolean> {
  const { error } = await supabase
    .from('seasons')
    .update({ status })
    .eq('id', seasonId);

  if (error) {
    console.error('Error updating season status:', error);
    return false;
  }
  return true;
}

// Add teams to season
export async function addTeamsToSeason(seasonId: number, teamIds: number[]): Promise<boolean> {
  const seasonTeams = teamIds.map(teamId => ({
    season_id: seasonId,
    team_id: teamId
  }));

  const { error } = await supabase
    .from('season_teams')
    .insert(seasonTeams);

  if (error) {
    console.error('Error adding teams to season:', error);
    return false;
  }
  return true;
}

// Get teams for a season
export async function getSeasonTeams(seasonId: number): Promise<SeasonTeam[]> {
  const { data, error } = await supabase
    .from('season_teams')
    .select(`
      *,
      team:Team (
        id,
        name,
        player_defense_id,
        player_offense_id
      )
    `)
    .eq('season_id', seasonId);

  if (error) {
    console.error('Error fetching season teams:', error);
    return [];
  }
  return data || [];
}

// Generate fixtures for a season (round-robin, home and away)
export async function generateFixtures(seasonId: number): Promise<boolean> {
  try {
    // Get teams for this season
    const seasonTeams = await getSeasonTeams(seasonId);
    const teams = seasonTeams.map(st => st.team_id);
    
    if (teams.length < 2) {
      console.error('Need at least 2 teams to generate fixtures');
      return false;
    }

    const fixtures: Omit<SeasonFixture, 'id' | 'created_at'>[] = [];

    // Generate round-robin fixtures (each team plays every other team twice - home and away)
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        // First leg: team i at home (white), team j away (blue)
        fixtures.push({
          season_id: seasonId,
          home_team_id: teams[i],
          away_team_id: teams[j]
        });

        // Second leg: team j at home (white), team i away (blue)
        fixtures.push({
          season_id: seasonId,
          home_team_id: teams[j],
          away_team_id: teams[i]
        });
      }
    }

    // Clear existing fixtures first
    await supabase
      .from('season_fixtures')
      .delete()
      .eq('season_id', seasonId);

    // Insert new fixtures
    const { error } = await supabase
      .from('season_fixtures')
      .insert(fixtures);

    if (error) {
      console.error('Error generating fixtures:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in generateFixtures:', error);
    return false;
  }
}

// Get fixtures for a season
export async function getSeasonFixtures(seasonId: number): Promise<SeasonFixture[]> {
  const { data, error } = await supabase
    .from('season_fixtures')
    .select(`
      *,
      home_team:Team!season_fixtures_home_team_id_fkey (
        id,
        name,
        player_defense_id,
        player_offense_id
      ),
      away_team:Team!season_fixtures_away_team_id_fkey (
        id,
        name,
        player_defense_id,
        player_offense_id
      )
    `)
    .eq('season_id', seasonId)
    .order('created_at');

  if (error) {
    console.error('Error fetching season fixtures:', error);
    return [];
  }
  return data || [];
}

// Update fixture score
export async function updateFixtureScore(
  fixtureId: number,
  homeScore: number,
  awayScore: number
): Promise<boolean> {
  const { error } = await supabase
    .from('season_fixtures')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      played_at: new Date().toISOString()
    })
    .eq('id', fixtureId);

  if (error) {
    console.error('Error updating fixture score:', error);
    return false;
  }
  return true;
}

// Calculate season standings
export async function getSeasonStandings(seasonId: number): Promise<SeasonStanding[]> {
  try {
    const fixtures = await getSeasonFixtures(seasonId);
    const seasonTeams = await getSeasonTeams(seasonId);
    
    const standings: Record<number, SeasonStanding> = {};
    
    // Initialize standings for all teams
    seasonTeams.forEach(st => {
      if (st.team) {
        standings[st.team_id] = {
          team_id: st.team_id,
          team_name: st.team.name,
          matches_played: 0,
          matches_won: 0,
          matches_drawn: 0,
          matches_lost: 0,
          goals_scored: 0,
          goals_conceded: 0,
          goal_difference: 0,
          points: 0
        };
      }
    });

    // Process played fixtures
    fixtures.forEach(fixture => {
      if (fixture.home_score !== null && fixture.away_score !== null && 
          fixture.home_score !== undefined && fixture.away_score !== undefined) {
        const homeStanding = standings[fixture.home_team_id];
        const awayStanding = standings[fixture.away_team_id];
        
        if (homeStanding && awayStanding) {
          // Update matches played
          homeStanding.matches_played++;
          awayStanding.matches_played++;
          
          // Update goals
          homeStanding.goals_scored += fixture.home_score;
          homeStanding.goals_conceded += fixture.away_score;
          awayStanding.goals_scored += fixture.away_score;
          awayStanding.goals_conceded += fixture.home_score;
          
          // Update results and points
          if (fixture.home_score > fixture.away_score) {
            // Home team wins
            homeStanding.matches_won++;
            homeStanding.points += 3;
            awayStanding.matches_lost++;
          } else if (fixture.away_score > fixture.home_score) {
            // Away team wins
            awayStanding.matches_won++;
            awayStanding.points += 3;
            homeStanding.matches_lost++;
          } else {
            // Draw
            homeStanding.matches_drawn++;
            homeStanding.points += 1;
            awayStanding.matches_drawn++;
            awayStanding.points += 1;
          }
        }
      }
    });

    // Calculate goal difference
    Object.values(standings).forEach(standing => {
      standing.goal_difference = standing.goals_scored - standing.goals_conceded;
    });

    // Sort by points, then goal difference, then goals scored
    return Object.values(standings).sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.goal_difference !== b.goal_difference) return b.goal_difference - a.goal_difference;
      return b.goals_scored - a.goals_scored;
    });
  } catch (error) {
    console.error('Error calculating season standings:', error);
    return [];
  }
}

// Remove team from season
export async function removeTeamFromSeason(seasonId: number, teamId: number): Promise<boolean> {
  const { error } = await supabase
    .from('season_teams')
    .delete()
    .eq('season_id', seasonId)
    .eq('team_id', teamId);

  if (error) {
    console.error('Error removing team from season:', error);
    return false;
  }
  return true;
}

// Delete season (and all related data)
export async function deleteSeason(seasonId: number): Promise<boolean> {
  const { error } = await supabase
    .from('seasons')
    .delete()
    .eq('id', seasonId);

  if (error) {
    console.error('Error deleting season:', error);
    return false;
  }
  return true;
}

// Create teams from players and add them to season
export async function createTeamsFromPlayersAndAddToSeason(
  seasonId: number, 
  teamPairs: Array<{defense: User, offense: User}>
): Promise<boolean> {
  try {
    const teamInserts = teamPairs.map(pair => ({
      player_defense_id: pair.defense.id,
      player_offense_id: pair.offense.id,
      name: `${pair.defense.name} (D) & ${pair.offense.name} (O)`,
      created_at: new Date().toISOString().split('T')[0]
    }));

    // Insert teams
    const { data: createdTeams, error: teamError } = await supabase
      .from('Team')
      .insert(teamInserts)
      .select('id');

    if (teamError || !createdTeams) {
      console.error('Error creating teams:', teamError);
      return false;
    }

    // Add teams to season
    const seasonTeams = createdTeams.map(team => ({
      season_id: seasonId,
      team_id: team.id
    }));

    const { error: seasonTeamError } = await supabase
      .from('season_teams')
      .insert(seasonTeams);

    if (seasonTeamError) {
      console.error('Error adding teams to season:', seasonTeamError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in createTeamsFromPlayersAndAddToSeason:', error);
    return false;
  }
} 