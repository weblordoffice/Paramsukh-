export const buildCourseProgressContext = (course) => {
  const videos = course?.videos || [];
  const pdfs = course?.pdfs || [];
  const audioLessons = course?.audioLessons || [];
  const reflections = course?.reflections || [];

  return {
    totalVideos: videos.length,
    totalPdfs: pdfs.length,
    totalAudioLessons: audioLessons.length,
    requiredReflectionIds: reflections
      .filter((reflection) => reflection.isRequired !== false)
      .map((reflection) => reflection._id),
    videoIds: videos.map((video) => video._id),
    pdfIds: pdfs.map((pdf) => pdf._id),
    audioIds: audioLessons.map((lesson) => lesson._id),
    reflectionIds: reflections.map((reflection) => reflection._id),
  };
};

export const recomputeCourseProgress = (enrollment, course) => {
  if (!enrollment) return 0;
  return enrollment.updateProgress(buildCourseProgressContext(course));
};
