import React, { memo } from 'react';
import { View, TouchableOpacity, Image, Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const LED_TARGET_H = Math.max(320, Math.floor(SCREEN_H * 0.56));
const ROW_GAP = 2;

const SPEAKER_IMAGES = [require('../../assets/fg2.jpeg'), require('../../assets/fg4.jpeg')];

const SPKR_BAR_ROWS = 48;
const SPKR_BAR_ROWS_ARR = Array.from({ length: SPKR_BAR_ROWS }, (_, i) => i);

const getBarCellColor = (rowFromBottom: number): string => {
  const ratio = rowFromBottom / SPKR_BAR_ROWS;
  if (ratio <= 0.28) return '#00FF44';
  if (ratio <= 0.46) return '#55FF00';
  if (ratio <= 0.6) return '#AAFF00';
  if (ratio <= 0.73) return '#FFD700';
  if (ratio <= 0.84) return '#FF8C00';
  if (ratio <= 0.92) return '#FF4500';
  return '#FF0000';
};

interface SpeakerViewProps {
  barLevel: number;
  speakerImgIdx: number;
  onSpeakerPress: () => void;
}

const SpeakerView: React.FC<SpeakerViewProps> = ({ barLevel, speakerImgIdx, onSpeakerPress }) => {
  const areaW = SCREEN_W - 24;
  const areaH = Math.min(LED_TARGET_H, Math.floor(SCREEN_H * 0.52));

  const barW = 14;
  const barGap = 6;
  const barGroupW = barW * 2 + barGap;
  const speakerAreaW = areaW - barGroupW * 2 - 24;
  const barH = Math.min(areaH - 16, 340);
  const cellH = Math.max(1, Math.floor((barH - ROW_GAP * (SPKR_BAR_ROWS - 1)) / SPKR_BAR_ROWS));

  const litCount = Math.max(1, Math.round(barLevel * SPKR_BAR_ROWS));

  const renderBar = (keyPrefix: string) => (
    <View style={{ gap: barGap, flexDirection: 'row' }}>
      {[0, 1].map(bi => (
        <View key={`${keyPrefix}-${bi}`} style={{ gap: ROW_GAP }}>
          {SPKR_BAR_ROWS_ARR.map(rowIdx => {
            const fromBottom = SPKR_BAR_ROWS - 1 - rowIdx;
            const isLit = fromBottom < litCount;
            return (
              <View
                key={rowIdx}
                style={{
                  width: barW,
                  height: cellH,
                  borderRadius: 2,
                  backgroundColor: isLit ? getBarCellColor(fromBottom) : 'rgba(40,40,40,0.35)',
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );

  return (
    <View
      style={{
        width: areaW,
        height: areaH,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}>
      {renderBar('L')}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onSpeakerPress}
        style={{
          flex: 1,
          height: barH,
          backgroundColor: '#0a0a0a',
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: '#2a2a2a',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.8,
          shadowRadius: 12,
        }}>
        <Image
          source={SPEAKER_IMAGES[speakerImgIdx]}
          style={{ width: speakerAreaW, height: barH }}
          resizeMode="cover"
        />
      </TouchableOpacity>
      {renderBar('R')}
    </View>
  );
};

export { SPEAKER_IMAGES };
export default memo(SpeakerView);
