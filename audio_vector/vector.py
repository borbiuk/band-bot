import librosa
import numpy as np
import sys

def extract_audio_vector(file_path: str, n_mfcc: int = 25) -> np.ndarray:
    try:
        # Load audio (librosa handles wav, flac, mp3)
        y, sr = librosa.load(file_path, sr=None, mono=True)  # mono=True for consistency
        # Extract MFCCs
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
        # Mean vector across time axis
        vector = np.mean(mfcc, axis=1)
        # Normalize (optional)
        vector = vector / np.linalg.norm(vector)
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
            print(f"Vector (length {len(vec)}):\n{vec}")
