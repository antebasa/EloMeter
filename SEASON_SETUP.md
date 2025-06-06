# 🏆 Season League System Setup

## Overview
The Season League system is a standalone league module within EloMeter that allows you to create fixed-team tournaments with round-robin fixtures. This system does **NOT** affect the main ELO rankings and operates independently.

## Database Setup

### 1. Run Database Schema
Execute the SQL commands in `database_schema.sql` in your Supabase SQL editor to create the required tables:

```sql
-- Copy and paste the contents of database_schema.sql
-- This will create: seasons, season_teams, season_fixtures tables
```

### 2. Verify Tables Created
Check that these tables exist in your Supabase database:
- `seasons` - Stores season information
- `season_teams` - Links teams to specific seasons  
- `season_fixtures` - Stores all match fixtures and results

## Features

### 🎯 **Core Functionality**
- **Fixed Teams**: Teams stay the same throughout a season (1 week or longer)
- **Round-Robin**: Every team plays every other team twice (home/away)
- **Color System**: Home team = White side, Away team = Blue side
- **Standalone Scoring**: Completely separate from main ELO system
- **Admin Controls**: Only admins can create seasons and enter scores

### 📊 **Scoring System**
- **Win**: 3 points
- **Draw**: 1 point each
- **Loss**: 0 points

### 🏅 **Ranking Logic**
1. **Points** (highest first)
2. **Goal Difference** (highest first)  
3. **Goals Scored** (highest first)
4. **Head-to-head** (if tied, playoff matches needed)

## How to Use

### For Admins

#### 1. Create a New Season
1. Navigate to **Season League** → **Management** tab
2. Click **Create New Season**
3. Enter season name (e.g., "Season 1 - January 2024")
4. Select start date
5. Choose teams (minimum 2 required)
6. Click **Create Season**

**System automatically:**
- Generates all round-robin fixtures
- Creates home/away matches for each team pair
- Sets season status to "draft"

#### 2. Manage Season Status
- **Draft**: Season created but not started
- **Active**: Season is currently running
- **Completed**: Season finished

#### 3. Enter Match Results
1. Go to **Fixtures** tab
2. Select the season
3. Click on any fixture (admin only)
4. Enter scores for home (white) and away (blue) teams
5. Save scores

### For All Users

#### View League Table
1. Navigate to **Season League** → **League Table**
2. Select season from dropdown
3. View current standings with full statistics

#### View Fixtures
1. Go to **Fixtures** tab  
2. Select season
3. See all matches with:
   - **Scheduled**: Shows "VS" 
   - **Played**: Shows final scores and winner

## UI Components

### 📱 **Season Management** (Admin Only)
- Create new seasons
- Select participating teams
- Change season status
- Delete seasons
- Manual team adjustments

### 🗓️ **Season Fixtures**
- View all matches for selected season
- See which team plays on white/blue side
- Enter scores (admin only)
- Filter by played/scheduled

### 🏆 **Season Table**
- Full league standings
- Statistics: MP, W, D, L, GF, GA, GD, Pts, Win%
- Season selector dropdown
- Visual position indicators (gold/silver/bronze for top 3)

## Database Structure

### Tables Schema

```sql
seasons {
  id: number (PK)
  name: string
  start_date: date
  end_date: date (optional)
  status: 'draft' | 'active' | 'completed'
  created_at: timestamp
}

season_teams {
  id: number (PK)  
  season_id: number (FK → seasons.id)
  team_id: number (FK → Team.id)
  created_at: timestamp
}

season_fixtures {
  id: number (PK)
  season_id: number (FK → seasons.id)
  home_team_id: number (FK → Team.id) // White side
  away_team_id: number (FK → Team.id) // Blue side
  home_score: number (optional)
  away_score: number (optional)
  played_at: timestamp (optional)
  created_at: timestamp
}
```

## Navigation

### Menu Structure
```
EloMeter
├── Season League ⭐ NEW
│   ├── League Table
│   ├── Fixtures  
│   └── Management (Admin only)
├── Live Match
├── Match Odds
├── History
└── ...existing items
```

## Example Season Flow

### 1. Admin Creates Season
```
Season: "January Cup 2024"
Teams: Team A, Team B, Team C, Team D
Status: Draft → Active
```

### 2. Auto-Generated Fixtures
```
Round 1:
- Team A (White) vs Team B (Blue)
- Team C (White) vs Team D (Blue)

Round 2:  
- Team A (White) vs Team C (Blue)
- Team B (White) vs Team D (Blue)

Round 3:
- Team A (White) vs Team D (Blue)
- Team B (White) vs Team C (Blue)

Return Fixtures:
- All matches repeated with colors swapped
```

### 3. Season Results
```
Final Table:
1. Team A - 15 pts (+8 GD)
2. Team B - 12 pts (+3 GD)  
3. Team C - 6 pts (-2 GD)
4. Team D - 3 pts (-9 GD)
```

## Technical Notes

- **Real-time Updates**: Tables refresh automatically when scores are entered
- **Responsive Design**: Works on mobile and desktop
- **Error Handling**: Comprehensive validation and error messages
- **Performance**: Optimized queries with proper indexing
- **Security**: Admin-only controls for sensitive operations

## Troubleshooting

### Common Issues

1. **No teams showing**: Ensure Team table has data
2. **Fixtures not generating**: Check minimum 2 teams selected
3. **Scores not saving**: Verify admin permissions
4. **Table not updating**: Refresh page or check network

### Database Permissions
Ensure proper RLS policies are set for:
- Public read access to all season tables
- Authenticated write access (restrict to admin if needed)

---

🎮 **Ready to create your first season league!** Navigate to Season League → Management to get started. 