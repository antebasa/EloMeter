# Live Match Feature Setup Guide

## Database Setup

### 1. Create the Live Matches Table

Run this SQL in your Supabase SQL editor:

```sql
-- Create the live_matches table
CREATE TABLE live_matches (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  white_team_defense_id INTEGER REFERENCES "User"(id),
  white_team_offense_id INTEGER REFERENCES "User"(id),
  blue_team_defense_id INTEGER REFERENCES "User"(id),
  blue_team_offense_id INTEGER REFERENCES "User"(id),
  white_score INTEGER DEFAULT 0,
  blue_score INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'finished', 'cancelled', 'completed'
  finished_at TIMESTAMP WITH TIME ZONE,
  confirmed_by_white BOOLEAN DEFAULT FALSE,
  confirmed_by_blue BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE live_matches ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON live_matches
  FOR ALL USING (auth.role() = 'authenticated');
```

### 2. Enable Realtime

1. Go to your Supabase dashboard
2. Navigate to Database > Replication
3. Find the `live_matches` table
4. Enable realtime for this table

## Features

### 1. Live Match Control Page (`/app/live-match`)
- Create new live matches by selecting teams
- View active matches
- Navigate to match display or team control screens

### 2. Team Control Pages (`/app/live-match/{id}/white` or `/app/live-match/{id}/blue`)
- Mobile-optimized interface with large buttons
- Three main actions:
  - **Attack Goal**: +1 for your team
  - **Defense Goal**: -1 from opponent team
  - **Backspace**: -1 from your team (undo)
- Real-time score updates
- Full-screen mobile experience

### 3. Live Score Display (`/app/live-match/{id}/display`)
- Real-time score display
- Team information with player names
- Links to team control screens
- Automatic game completion detection (first to 10 goals)
- Match confirmation and ELO integration

## Usage Workflow

1. **Start a Match**:
   - Go to Live Match from the main menu
   - Select 4 players (2 for each team)
   - Click "Start Live Match"

2. **Team Control**:
   - Players open the team control links on their mobile devices
   - White team: `/app/live-match/{id}/white`
   - Blue team: `/app/live-match/{id}/blue`

3. **Score Tracking**:
   - Players tap buttons to update scores in real-time
   - All connected devices see updates instantly
   - Game automatically ends when a team reaches 10 goals

4. **Match Completion**:
   - Confirmation dialog appears when game ends
   - Option to save to database and update ELO ratings
   - Integration with existing match system

## Mobile Optimization

The team control screens are designed for mobile use:
- Full-screen layout
- Large, touch-friendly buttons
- Clear visual feedback
- Team-specific color schemes (white/gray vs blue)
- Responsive design

## Real-time Features

- Instant score updates across all devices
- Live match status changes
- Automatic game completion detection
- Real-time player notifications

## Integration

The live match system integrates seamlessly with your existing ELO system:
- Completed matches are saved using the existing `saveMatch` function
- ELO ratings are updated automatically
- Match history is preserved
- All existing match validation and processing applies

## Troubleshooting

### Common Issues:

1. **Realtime not working**: Ensure the `live_matches` table has realtime enabled in Supabase
2. **Permission errors**: Check that RLS policies are correctly set up
3. **Mobile layout issues**: Ensure viewport meta tag is set in your HTML
4. **Score updates failing**: Check network connectivity and Supabase connection

### Debug Tips:

- Check browser console for errors
- Verify Supabase environment variables
- Test with multiple devices/browsers
- Monitor Supabase logs for database errors

## Future Enhancements

Potential improvements for future iterations:
- Sound effects for goal scoring
- Match statistics and analytics
- Tournament mode with multiple matches
- Spectator mode with read-only access
- Match replay functionality
- Custom game rules (different winning scores)
- Team chat functionality 