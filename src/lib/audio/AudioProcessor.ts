// src/lib/audio/AudioProcessor.ts

export interface AudioFeatures {
  mfcc: number[];
  spectralCentroid: number;
  zeroCrossingRate: number;
  energy: number;
}

export interface AudioFingerprint {
  hash: string;
  features: AudioFeatures;
  timestamp: number;
}

export interface AudioProcessorConfig {
  windowSize: number;
  hopSize: number;
  sampleRate: number;
  melFilterCount: number;
}

export const defaultAudioProcessorConfig: AudioProcessorConfig = {
  windowSize: 2048,
  hopSize: 512,
  sampleRate: 44100,
  melFilterCount: 13
};

export class AudioProcessor {
  private config: AudioProcessorConfig;

  constructor(config: AudioProcessorConfig = defaultAudioProcessorConfig) {
    this.config = config;
  }

  public extractFeatures(audioBuffer: Float32Array): AudioFeatures {
    // Calculate basic audio features from the buffer
    const energy = this.calculateEnergy(audioBuffer);
    const zeroCrossingRate = this.calculateZeroCrossingRate(audioBuffer);
    const spectralCentroid = this.calculateSpectralCentroid(audioBuffer);
    const mfcc = this.calculateMFCC(audioBuffer);

    return {
      mfcc,
      spectralCentroid,
      zeroCrossingRate,
      energy
    };
  }

  private calculateEnergy(audioBuffer: Float32Array): number {
    return audioBuffer.reduce((sum, sample) => sum + sample * sample, 0) / audioBuffer.length;
  }

  private calculateZeroCrossingRate(audioBuffer: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < audioBuffer.length; i++) {
      if ((audioBuffer[i] >= 0) !== (audioBuffer[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / audioBuffer.length;
  }

  private calculateSpectralCentroid(audioBuffer: Float32Array): number {
    // Simplified spectral centroid calculation
    const fftSize = Math.min(audioBuffer.length, this.config.windowSize);
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < fftSize / 2; i++) {
      const magnitude = Math.abs(audioBuffer[i]);
      const frequency = (i * this.config.sampleRate) / fftSize;
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateMFCC(audioBuffer: Float32Array): number[] {
    // Simplified MFCC calculation - placeholder implementation
    // Using audioBuffer length to make calculation deterministic
    const baseValue = audioBuffer.length > 0 ? audioBuffer[0] * 0.01 : 0;
    return new Array(this.config.melFilterCount).fill(0).map((_, index) => 
      baseValue + (index * 0.001) // Deterministic values based on index
    );
  }

  public generateFingerprint(audioBuffer: Float32Array): AudioFingerprint {
    const features = this.extractFeatures(audioBuffer);
    const hash = this.computeHash(features);
    
    return {
      hash,
      features,
      timestamp: Date.now()
    };
  }

  private computeHash(features: AudioFeatures): string {
    // Simple hash implementation for now
    const str = JSON.stringify(features);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}