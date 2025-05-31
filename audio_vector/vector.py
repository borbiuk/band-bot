import librosa
import numpy as np
import sys

# Configuration array with 10 different configurations
configs = [
    # Configuration 0: Base configuration (original)
    # Output vector length: n_mfcc * 3 = 60 * 3 = 180
    {
        "n_mfcc": 60,
        "sr": 44100,
        "combine_deltas": True,
        "average_method": "mean",
        "normalize": True,
    },
    # Configuration 1: Reduced MFCC count, no deltas
    # Output vector length: n_mfcc = 40
    {
        "n_mfcc": 40,
        "sr": 22050,
        "combine_deltas": False,
        "average_method": "mean",
        "normalize": True,
    },
    # Configuration 2: Increased MFCC count, median instead of mean
    # Output vector length: n_mfcc * 3 = 80 * 3 = 240
    {
        "n_mfcc": 80,
        "sr": 48000,
        "combine_deltas": True,
        "average_method": "median",
        "normalize": True,
    },
    # Configuration 3: No vector normalization
    # Output vector length: n_mfcc * 3 = 60 * 3 = 180
    {
        "n_mfcc": 60,
        "sr": 44100,
        "combine_deltas": True,
        "average_method": "mean",
        "normalize": False,
    },
    # Configuration 4: Maximum detail with high sampling rate
    # Output vector length: n_mfcc * 3 = 100 * 3 = 300
    {
        "n_mfcc": 100,
        "sr": 96000,
        "combine_deltas": True,
        "average_method": "mean",
        "normalize": True,
    },
    # Configuration 5: Only MFCC, low sampling rate for lightweight extraction
    # Output vector length: n_mfcc = 20
    {
        "n_mfcc": 20,
        "sr": 16000,
        "combine_deltas": False,
        "average_method": "mean",
        "normalize": True,
    },
    # Configuration 6: Alternative normalization using power instead of time-based MFCC
    # Output vector length: n_mfcc * 3 = 50 * 3 = 150
    {
        "n_mfcc": 50,
        "sr": 22050,
        "combine_deltas": True,
        "average_method": "mean",
        "normalize": True,
    },
    # Configuration 7: Shorter MFCC range, no deltas, median averaging
    # Output vector length: n_mfcc = 30
    {
        "n_mfcc": 30,
        "sr": 44100,
        "combine_deltas": False,
        "average_method": "median",
        "normalize": True,
    },
    # Configuration 8: High MFCC range combining power and deltas
    # Output vector length: n_mfcc * 3 = 80 * 3 = 240
    {
        "n_mfcc": 80,
        "sr": 32000,
        "combine_deltas": True,
        "average_method": "mean",
        "normalize": True,
    },
    # Configuration 9: Maximized spectro-temporal description
    # Output vector length: n_mfcc * 3 = 120 * 3 = 360
    {
        "n_mfcc": 120,
        "sr": 96000,
        "combine_deltas": True,
        "average_method": "mean",
        "normalize": True,
    },
]


def extract_audio_vector(file_path: str, config_idx: int = 0) -> np.ndarray:
    """
    Extract audio vector based on the selected configuration.

    Parameters:
    file_path (str): Path to the audio file.
    config_idx (int): Index of the configuration to use (default is 0).

    Returns:
    np.ndarray: Extracted vector or None in case of an error.
    """
    try:
        # Select configuration
        config = configs[config_idx]

        # Load audio file with the configured sampling rate and mono mode
        y, sr = librosa.load(file_path, sr=config["sr"], mono=True)

        # Extract MFCCs
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=config["n_mfcc"])

        # Add deltas if enabled
        if config["combine_deltas"]:
            mfcc_delta = librosa.feature.delta(mfcc)
            mfcc_delta2 = librosa.feature.delta(mfcc, order=2)
            # Combine MFCC, delta, and delta-delta
            combined = np.vstack([mfcc, mfcc_delta, mfcc_delta2])
        else:
            combined = mfcc

        # Apply averaging method
        if config["average_method"] == "mean":
            vector = np.mean(combined, axis=1)
        elif config["average_method"] == "median":
            vector = np.median(combined, axis=1)
        else:
            raise ValueError(f"Unknown averaging method: {config['average_method']}")

        # Normalize vector if enabled
        if config["normalize"]:
            norm = np.linalg.norm(vector)
            if norm > 0:
                vector = vector / norm

        return vector

    except Exception as e:
        print(f"Error processing '{file_path}' with configuration {config_idx}: {e}")
        return None


# Example usage within a standalone script
if __name__ == "__main__":
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("Usage: python audio_vectorizer.py <path_to_audio> [config_idx]")
    else:
        # Get file path and optional configuration index
        file_path = sys.argv[1]
        config_idx = int(sys.argv[2]) if len(sys.argv) == 3 else 0

        # Extract audio vector
        vector = extract_audio_vector(file_path, config_idx)

        # Print result if vector extraction was successful
        if vector is not None:
            print(vector)
