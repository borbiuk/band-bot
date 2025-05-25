import librosa
import numpy as np
import sys

def extract_audio_vector(file_path: str, n_mfcc: int = 60) -> np.ndarray:
    try:
        # Load audio with fixed sampling rate and mono
        y, sr = librosa.load(file_path, sr=44100, mono=True)

        # Extract MFCCs
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)

        # Compute delta (1st derivative)
        mfcc_delta = librosa.feature.delta(mfcc)

        # Compute delta-delta (2nd derivative)
        mfcc_delta2 = librosa.feature.delta(mfcc, order=2)

        # Stack all features [n_mfcc x frames * 3]
        combined = np.vstack([mfcc, mfcc_delta, mfcc_delta2])

        # Average across time (axis=1)
        vector = np.mean(combined, axis=1)

        # Normalize to unit norm
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm

        return vector
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

# Example usage: `python audio_vectorizer.py path/to/audio.mp3`
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python audio_vectorizer.py <path_to_audio>")
    else:
        path = sys.argv[1]
        vec = extract_audio_vector(path)
        if vec is not None:
            print(vec)
