import React, { useEffect, useRef } from 'react';
import { Participant, PerkMetadata } from './types/detailsLiveTypes';
import { useResponsive } from '../../hooks/useResponsive';
import './styles/playerDetailDrawer.css';

type Props = {
  participant: Participant;
  teamSide: 'blue' | 'red';
  isVisible: boolean;
  onClose: () => void;
}

// Rune data mapping (simplified version - in a real app this would come from an API)
const RUNE_DATA: { [key: number]: { name: string, icon: string } } = {
  // Primary paths
  8000: { name: 'Precision', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Precision.png' },
  8100: { name: 'Domination', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Domination.png' },
  8200: { name: 'Sorcery', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7202_Sorcery.png' },
  8300: { name: 'Resolve', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Resolve.png' },
  8400: { name: 'Inspiration', icon: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Inspiration.png' },
};

// Ability key mapping
const ABILITY_KEYS = ['Q', 'W', 'E', 'R'];

export const PlayerDetailDrawer: React.FC<Props> = ({ participant, teamSide, isVisible, onClose }) => {
  const { isMobile } = useResponsive();
  const drawerRef = useRef<HTMLDivElement>(null);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);
  
  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node) && isVisible) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, onClose]);
  
  if (!isVisible || isMobile) {
    return null;
  }
  
  // Calculate kill participation percentage
  const killParticipationPercent = participant.killParticipation * 100;

  const normalizeAbilityKey = (value?: string) => {
    if (!value) {
      return '';
    }
    const trimmedValue = value.trim();

    const numericIndex = parseInt(trimmedValue, 10) - 1;
    if (!Number.isNaN(numericIndex) && numericIndex >= 0 && numericIndex < ABILITY_KEYS.length) {
      return ABILITY_KEYS[numericIndex];
    }

    const normalizedValue = trimmedValue.toUpperCase();
    const abilityMap: Record<string, string> = {
      Q: 'Q',
      W: 'W',
      E: 'E',
      R: 'R',
      ABILITY_Q: 'Q',
      ABILITY_W: 'W',
      ABILITY_E: 'E',
      ABILITY_R: 'R'
    };

    return abilityMap[normalizedValue] || '';
  };

  const abilitySequence = Array.from({ length: 18 }, (_, index) =>
    normalizeAbilityKey(participant.abilities?.[index])
  );
  
  return React.createElement(
    'div',
    {
      ref: drawerRef,
      className: `player-detail-drawer ${teamSide}`,
      role: 'dialog',
      'aria-labelledby': 'player-drawer-title',
      'aria-modal': 'true'
    },
    React.createElement(
      'div',
      { className: 'drawer-header' },
      [
        React.createElement(
          'h3',
          { key: 'title', id: 'player-drawer-title' },
          'Advanced Player Stats'
        ),
        React.createElement(
          'button',
          {
            key: 'close',
            className: 'close-button',
            onClick: onClose,
            'aria-label': 'Close player details'
          },
          '×'
        )
      ]
    ),
    React.createElement(
      'div',
      { className: 'drawer-content' },
      [
        // Advanced Stats Grid
        React.createElement(
          'div',
          { key: 'stats', className: 'stats-section' },
          [
            React.createElement('h4', { key: 'stats-title' }, 'Performance Stats'),
            React.createElement(
              'div',
              { key: 'stats-grid', className: 'stats-grid' },
              [
                React.createElement(
                  'div',
                  { key: 'kp', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'kp-label', className: 'stat-label' }, 'Kill Participation'),
                    React.createElement('div', { key: 'kp-value', className: 'stat-value' }, `${killParticipationPercent.toFixed(0)}%`)
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'dmg', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'dmg-label', className: 'stat-label' }, 'Damage Share'),
                    React.createElement('div', { key: 'dmg-value', className: 'stat-value' }, `${(participant.championDamageShare * 100).toFixed(1)}%`)
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'gold', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'gold-label', className: 'stat-label' }, 'Gold Earned'),
                    React.createElement('div', { key: 'gold-value', className: 'stat-value' }, participant.totalGoldEarned.toLocaleString())
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'cs', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'cs-label', className: 'stat-label' }, 'Creep Score'),
                    React.createElement('div', { key: 'cs-value', className: 'stat-value' }, participant.creepScore)
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'wards', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'wards-label', className: 'stat-label' }, 'Wards Placed'),
                    React.createElement('div', { key: 'wards-value', className: 'stat-value' }, participant.wardsPlaced)
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'wards-killed', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'wards-killed-label', className: 'stat-label' }, 'Wards Destroyed'),
                    React.createElement('div', { key: 'wards-killed-value', className: 'stat-value' }, participant.wardsDestroyed)
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'ad', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'ad-label', className: 'stat-label' }, 'Attack Damage'),
                    React.createElement('div', { key: 'ad-value', className: 'stat-value' }, participant.attackDamage)
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'ap', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'ap-label', className: 'stat-label' }, 'Ability Power'),
                    React.createElement('div', { key: 'ap-value', className: 'stat-value' }, participant.abilityPower)
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'armor', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'armor-label', className: 'stat-label' }, 'Armor'),
                    React.createElement('div', { key: 'armor-value', className: 'stat-value' }, participant.armor)
                  ]
                ),
                React.createElement(
                  'div',
                  { key: 'mr', className: 'stat-item' },
                  [
                    React.createElement('div', { key: 'mr-label', className: 'stat-label' }, 'Magic Resist'),
                    React.createElement('div', { key: 'mr-value', className: 'stat-value' }, participant.magicResistance)
                  ]
                )
              ]
            )
          ]
        ),
        
        // Rune Display
        React.createElement(
          'div',
          { key: 'runes', className: 'runes-section' },
          [
            React.createElement('h4', { key: 'runes-title' }, 'Rune Loadout'),
            React.createElement(RuneDisplay, {
              key: 'runes-display',
              perkMetadata: participant.perkMetadata
            })
          ]
        ),
        
        // Skill Order
        React.createElement(
          'div',
          { key: 'abilities', className: 'abilities-section' },
          [
            React.createElement('h4', { key: 'abilities-title' }, 'Skill Order'),
            React.createElement(
              'div',
              { key: 'abilities-sequence', className: 'abilities-sequence' },
              abilitySequence.map((abilityKey, index) =>
                React.createElement(
                  'div',
                  {
                    key: index,
                    className: `ability-square${abilityKey ? ` ability-square-${abilityKey.toLowerCase()}` : ' empty'}`,
                    'aria-label': abilityKey
                      ? `Level ${index + 1}: ability ${abilityKey}`
                      : `Level ${index + 1}: ability not selected`
                  },
                  abilityKey
                )
              )
            )
          ]
        )
      ]
    )
  );
};

// Rune Display Component
const RuneDisplay: React.FC<{ perkMetadata: PerkMetadata }> = ({ perkMetadata }) => {
  const primaryPath = RUNE_DATA[perkMetadata.styleId];
  const secondaryPath = RUNE_DATA[perkMetadata.subStyleId];
  
  return React.createElement(
    'div',
    { className: 'runes-container' },
    [
      // Primary Path
      React.createElement(
        'div',
        { key: 'primary', className: 'rune-path' },
        [
          React.createElement(
            'div',
            { key: 'primary-header', className: 'rune-path-header' },
            [
              React.createElement('img', {
                key: 'primary-icon',
                src: primaryPath?.icon || '',
                alt: primaryPath?.name || 'Primary Path',
                className: 'rune-path-icon',
                onError: (e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }
              }),
              React.createElement('span', { key: 'primary-name' }, primaryPath?.name || 'Primary')
            ]
          ),
          React.createElement(
            'div',
            { key: 'primary-slots', className: 'rune-slots' },
            perkMetadata.perks.slice(0, 4).map((perkId, index) =>
              React.createElement('img', {
                key: index,
                src: `https://ddragon.leagueoflegends.com/cdn/img/perk-images/${getRuneIconPath(perkId)}`,
                alt: `Rune ${index + 1}`,
                className: 'rune-icon',
                onError: (e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }
              })
            )
          )
        ]
      ),
      
      // Secondary Path
      React.createElement(
        'div',
        { key: 'secondary', className: 'rune-path' },
        [
          React.createElement(
            'div',
            { key: 'secondary-header', className: 'rune-path-header' },
            [
              React.createElement('img', {
                key: 'secondary-icon',
                src: secondaryPath?.icon || '',
                alt: secondaryPath?.name || 'Secondary Path',
                className: 'rune-path-icon',
                onError: (e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }
              }),
              React.createElement('span', { key: 'secondary-name' }, secondaryPath?.name || 'Secondary')
            ]
          ),
          React.createElement(
            'div',
            { key: 'secondary-slots', className: 'rune-slots' },
            perkMetadata.perks.slice(4, 6).map((perkId, index) =>
              React.createElement('img', {
                key: index,
                src: `https://ddragon.leagueoflegends.com/cdn/img/perk-images/${getRuneIconPath(perkId)}`,
                alt: `Secondary Rune ${index + 1}`,
                className: 'rune-icon',
                onError: (e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }
              })
            )
          )
        ]
      )
    ]
  );
};

// Helper function to get rune icon path (simplified)
function getRuneIconPath(perkId: number): string {
  // This is a simplified mapping - in a real app, you'd have a comprehensive mapping
  // or fetch this data from an API
  const runePaths: { [key: number]: string } = {
    8005: 'Styles/7200_Precision/PrecisionSummonAery.png',
    8008: 'Styles/7200_Precision/PrecisionArcaneComet.png',
    8021: 'Styles/7200_Precision/PrecisionPhaseRush.png',
    8010: 'Styles/7200_Precision/PrecisionFleetFootwork.png',
    8014: 'Styles/7200_Precision/PrecisionConqueror.png',
    8128: 'Styles/7201_Domination/DominationDarkHarvest.png',
    8136: 'Styles/7201_Domination/DominationHailOfBlades.png',
    8139: 'Styles/7201_Domination/DominationElectrocute.png',
    8143: 'Styles/7201_Domination/DominationPredator.png',
    8112: 'Styles/7201_Domination/DominationPressTheAttack.png',
    // Add more rune mappings as needed
  };
  
  return runePaths[perkId] || 'Styles/7200_Precision/PrecisionSummonAery.png';
}
