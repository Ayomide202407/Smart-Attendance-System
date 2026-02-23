from live.live_attendance import run_live_attendance

run_live_attendance(
    lecturer_id="3aeb727c-f195-4bd9-86db-459b735d6e72",
    course_id="43ca1b58-55db-4204-9b1d-b4bffe0ad7a2",
    threshold=0.8,
    confirm_frames=2,
    cooldown_seconds=30,
    recognize_every_n_frames=3,
    capture_zone=False
)
