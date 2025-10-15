import React from 'react';
import { GameMetadata } from "./types/windowLiveTypes";
import { GameDetails } from "./types/detailsPersistentTypes";
import { Frame as FrameDetails } from "./types/detailsLiveTypes";
import { Frame as FrameWindow, Participant as ParticipantWindow } from "./types/windowLiveTypes";
import { CHAMPIONS_URL } from '../../utils/LoLEsportsAPI';
// Removed unused imports since we're not displaying team stats and dragons in simple view
import './styles/playerTableSimple.css';

type Props = {
  lastFrameWindow: FrameWindow,
  lastFrameDetails: FrameDetails,
  gameMetadata: GameMetadata,
  gameDetails: GameDetails,
  blueTeam: any,
  redTeam: any,
}

export function PlayerTableSimple({
  lastFrameWindow,
  lastFrameDetails,
  gameMetadata,
  gameDetails,
  blueTeam,
  redTeam
}: Props) {
  const getGoldDifference = (player: ParticipantWindow, side: string) => {
    if (6 > player.participantId) { // blue side
      const redPlayer = lastFrameWindow.redTeam.participants[player.participantId - 1];
      const goldResult = player.totalGold - redPlayer.totalGold;
      return goldResult > 0 ? `+${Number(goldResult).toLocaleString("en-US")}` : Number(goldResult).toLocaleString("en-US");
    } else {
      const bluePlayer = lastFrameWindow.blueTeam.participants[player.participantId - 6];
      const goldResult = player.totalGold - bluePlayer.totalGold;
      return goldResult > 0 ? `+${Number(goldResult).toLocaleString("en-US")}` : Number(goldResult).toLocaleString("en-US");
    }
  };

  // Removed getDragonSVG function since we're not displaying dragons in simple view

  const renderSimplePlayerRow = (player: ParticipantWindow, teamSide: 'blue' | 'red') => {
    const metadata = teamSide === 'blue' 
      ? gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1]
      : gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6];
    
    const goldDiff = getGoldDifference(player, teamSide);
    const healthPercentage = (player.currentHealth / player.maxHealth) * 100;

    return (
      <div key={player.participantId} className="simple-player-row">
        <div className="simple-player-info">
          <div className="simple-player-champion">
            <img
              src={`${CHAMPIONS_URL}${metadata.championId}.png`}
              className="simple-player-champion"
              alt="champion image"
            />
            <div className="simple-player-level">{player.level}</div>
          </div>
          <div className="simple-player-details">
            <div className="simple-player-name">{metadata.summonerName}</div>
            <div className="simple-player-champion-name">{metadata.championId}</div>
          </div>
        </div>
        <div className="simple-player-stats">
          <div className="simple-player-hp">
            <div className="simple-health-bar">
              <div 
                className="simple-health-bar-fill" 
                style={{ width: `${healthPercentage}%` }}
              />
            </div>
          </div>
          <div className="simple-player-kda">
            {player.kills}/{player.deaths}/{player.assists}
          </div>
          <div className="simple-player-gold">
            {Number(player.totalGold).toLocaleString('en-US')}
          </div>
        </div>
      </div>
    );
  };

  const renderTeamHeader = (team: any, teamSide: 'blue' | 'red') => {
    return (
      <div className="simple-team-header">
        <div className="simple-team-name">{team.name.toUpperCase()}</div>
      </div>
    );
  };

  return (
    <div className="simple-player-table-container">
      {/* Blue Team */}
      {renderTeamHeader(blueTeam, 'blue')}
      <div className="simple-player-table">
        {lastFrameWindow.blueTeam.participants.map((player) =>
          renderSimplePlayerRow(player, 'blue')
        )}
      </div>

      {/* Red Team */}
      {renderTeamHeader(redTeam, 'red')}
      <div className="simple-player-table">
        {lastFrameWindow.redTeam.participants.map((player) =>
          renderSimplePlayerRow(player, 'red')
        )}
      </div>
    </div>
  );
};