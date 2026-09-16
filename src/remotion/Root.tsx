import React from 'react';
import { Composition } from 'remotion';
import { ManhwaRecapComposition } from './compositions/ManhwaRecapComposition';
import { DEFAULT_RECAP_PROPS, ManhwaRecapProps } from './types';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<any, ManhwaRecapProps>
        id="ManhwaRecapComposition"
        component={ManhwaRecapComposition}
        durationInFrames={255} // Default from sample props (4.5s + 4.0s = 8.5s * 30fps = 255)
        fps={30}
        width={1080}
        height={1920}
        defaultProps={DEFAULT_RECAP_PROPS}
        calculateMetadata={async ({ props }) => {
          const fps = props.fps || 30;
          const scenes = props.scenes || [];
          const totalDurationSec = scenes.reduce(
            (acc, s) => acc + (Number(s.durationInSeconds) || 4.0),
            0
          );
          const totalFrames = Math.max(30, Math.round(totalDurationSec * fps));
          return {
            durationInFrames: totalFrames,
            fps,
          };
        }}
      />
    </>
  );
};
