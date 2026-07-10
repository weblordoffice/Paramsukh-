const formatCurrency = (amount, currency = 'INR') => {
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
    return 'Free';
  }

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

const toSentence = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  return text.length > 140 ? `${text.slice(0, 137).trim()}...` : text;
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const buildCourseListSection = (toolName, data) => {
  const items = normalizeArray(data?.items).map((item) => ({
    id: item?.id || null,
    title: item?.title || item?.course_title || 'Untitled course',
    category: item?.category || item?.course_category || null,
    duration: item?.duration || item?.course_duration || null,
    description: toSentence(item?.description || item?.course_description),
    color: item?.color || item?.course_color || null,
    thumbnailUrl: item?.thumbnail_url || null,
    icon: item?.icon || item?.course_icon || null,
    progress: typeof item?.progress === 'number' ? item.progress : null,
    lastAccessedLabel: item?.last_accessed_at ? 'Recently active' : null,
    completionLabel: item?.is_completed ? 'Completed' : null,
    accessMessage: item?.access?.message || null,
    accessReason: item?.access?.reason || null,
    status: item?.status || null,
    accessLabel: item?.access?.canAccess === true
      ? 'Accessible'
      : item?.access?.reason === 'already_enrolled'
        ? 'Enrolled'
        : item?.access?.canEnroll === true
          ? 'Can enroll'
          : item?.access?.reason === 'membership_required'
            ? 'Upgrade needed'
            : null,
    ratingLabel:
      typeof item?.average_rating === 'number' && item.average_rating > 0
        ? `${Number(item.average_rating).toFixed(1)} rating`
        : null,
    videoCountLabel:
      typeof item?.total_videos === 'number' && item.total_videos > 0
        ? `${item.total_videos} videos`
        : null,
    pdfCountLabel:
      typeof item?.total_pdfs === 'number' && item.total_pdfs > 0
        ? `${item.total_pdfs} PDFs`
        : null,
    planCountLabel: Array.isArray(item?.included_in_plans) && item.included_in_plans.length > 0
      ? `${item.included_in_plans.length} plan${item.included_in_plans.length > 1 ? 's' : ''}`
      : null,
    includedInPlans: item?.included_in_plans || [],
    badges: [
      item?.access?.reason === 'already_enrolled' ? 'Already enrolled' : null,
      typeof item?.recommendation_score === 'number' ? `Score ${item.recommendation_score}` : null,
      typeof item?.enrollment_count === 'number' && item.enrollment_count > 0 ? `${item.enrollment_count} learners` : null,
    ].filter(Boolean),
  }));

  if (items.length === 0) {
    return [];
  }

  return [
    {
      kind: 'course_list',
      title:
        toolName === 'recommend_courses'
          ? 'Recommended Courses'
          : toolName === 'get_my_enrollments'
            ? 'Your Courses'
            : toolName === 'get_continue_learning'
              ? 'Continue Learning'
              : data?.listing_mode === 'catalog'
            ? 'Available Courses'
            : 'Matching Courses',
      items,
    },
  ];
};

const buildEnrollmentOverviewSection = (data) => {
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    return [];
  }

  if (!data.items.length) {
    return [
      {
        kind: 'status_card',
        title: 'Your Learning',
        status: 'empty',
        rows: [
          { label: 'Enrolled', value: '0' },
          { label: 'In Progress', value: '0' },
          { label: 'Completed', value: '0' },
        ],
      },
    ];
  }

  return [
    {
      kind: 'status_card',
      title: 'Your Learning Snapshot',
      status: data?.completed_only ? 'completed' : data?.in_progress_only ? 'in progress' : 'active',
      rows: [
        { label: 'Enrolled', value: String(data?.total ?? data.items.length) },
        { label: 'Showing Now', value: String(data?.visible_count ?? data.items.length) },
        { label: 'In Progress', value: String(data?.in_progress_count ?? 0) },
        { label: 'Completed', value: String(data?.completed_count ?? 0) },
        { label: 'Average Progress', value: `${data?.average_progress ?? 0}%` },
      ],
    },
  ];
};

const buildEventListSection = (data, title = 'Events') => {
  const mapEventItem = (item) => ({
    id: item?.id || null,
    title: item?.title || 'Untitled event',
    category: item?.category || null,
    date: item?.event_date || null,
    time: item?.event_time || item?.start_time || null,
    location: item?.location || item?.event_location || null,
    locationType: item?.location_type || null,
    status: item?.status || item?.event_status || null,
    priceLabel: formatCurrency(item?.price, item?.currency || 'INR'),
    isPaid: !!item?.is_paid,
    description: toSentence(item?.description),
  });

  const broadQuery = !!data?.broad_query;
  const paidItems = normalizeArray(data?.paid_items).map(mapEventItem);
  const freeItems = normalizeArray(data?.free_items).map(mapEventItem);
  const items = normalizeArray(data?.items).map(mapEventItem);

  if (broadQuery) {
    const sections = [];
    if (paidItems.length > 0) {
      sections.push({
        kind: 'event_list',
        title: 'Paid Events',
        items: paidItems,
      });
    }
    if (freeItems.length > 0) {
      sections.push({
        kind: 'event_list',
        title: 'Free Events',
        items: freeItems,
      });
    }
    return sections;
  }

  if (items.length === 0) {
    return [];
  }

  return [
    {
      kind: 'event_list',
      title,
      items,
    },
  ];
};

const buildEventDetailSection = (data) => {
  const event = data?.event;
  if (!event) {
    return [];
  }

  const rows = normalizeArray(data?.rows).length
    ? data.rows
    : [
        { label: 'Date', value: event?.event_date || 'Not available' },
        { label: 'Time', value: event?.event_time || event?.start_time || 'Not available' },
        { label: 'Location', value: event?.location || 'Not available' },
        { label: 'Format', value: event?.location_type || 'Not available' },
      ];

  return [
    {
      kind: 'status_card',
      title: event?.title || 'Event Details',
      status: data?.detail_focus || 'details',
      rows,
    },
    {
      kind: 'event_list',
      title: 'Selected Event',
      items: [
        {
          id: event?.id || null,
          title: event?.title || 'Untitled event',
          category: event?.category || null,
          date: event?.event_date || null,
          time: event?.event_time || event?.start_time || null,
          location: event?.location || null,
          locationType: event?.location_type || null,
          status: event?.status || null,
          priceLabel: formatCurrency(event?.price, event?.currency || 'INR'),
          isPaid: !!event?.is_paid,
          description: toSentence(event?.description),
        },
      ],
    },
  ];
};

const buildEventComparisonSection = (data) => {
  const items = normalizeArray(data?.items).map((item) => ({
    id: item?.id || null,
    title: item?.title || 'Untitled event',
    category: item?.category || null,
    date: item?.event_date || null,
    time: item?.event_time || item?.start_time || null,
    location: item?.location || null,
    locationType: item?.location_type || null,
    status: item?.status || null,
    priceLabel: formatCurrency(item?.price, item?.currency || 'INR'),
    isPaid: !!item?.is_paid,
    description: toSentence(item?.description),
  }));

  if (!items.length && !normalizeArray(data?.rows).length) {
    return [];
  }

  return [
    {
      kind: 'comparison_card',
      title: 'Event Comparison',
      status: data?.focus || 'comparison',
      rows: normalizeArray(data?.rows),
      items,
      recommendedId: data?.recommended_event_id || null,
      recommendedTitle: data?.recommended_event_title || null,
    },
  ];
};

const buildRegistrationListSection = (data) => {
  const items = normalizeArray(data?.items).map((item) => ({
    id: item?.registration_id || null,
    title: item?.event_title || 'Event registration',
    status: item?.status || null,
    paymentStatus: item?.payment_status || null,
    date: item?.event_date || null,
    time: item?.event_time || null,
    location: item?.event_location || null,
    priceLabel: formatCurrency(item?.payment_amount, 'INR'),
  }));

  if (items.length === 0) {
    return [];
  }

  return [
    {
      kind: 'registration_list',
      title: 'Your Event Registrations',
      items,
    },
  ];
};

const buildMembershipListSection = (data) => {
  const items = normalizeArray(data?.items).map((item) => ({
    id: item?.id || null,
    title: item?.title || 'Membership',
    slug: item?.slug || null,
    description: item?.short_description || null,
    validityDays: item?.validity_days || null,
    priceLabel: formatCurrency(item?.pricing?.oneTime?.amount, item?.pricing?.oneTime?.currency || 'INR'),
    benefits: normalizeArray(item?.benefits)
      .filter((benefit) => benefit?.included !== false)
      .slice(0, 3)
      .map((benefit) => benefit?.text)
      .filter(Boolean),
  }));

  if (items.length === 0) {
    return [];
  }

  return [
    {
      kind: 'membership_list',
      title: 'Membership Plans',
      items,
    },
  ];
};

const buildSubscriptionSection = (data) => [
  {
    kind: 'status_card',
    title: 'Your Subscription',
    status: data?.subscription_status || 'unknown',
    rows: [
      { label: 'Plan', value: data?.subscription_plan || 'Free' },
      { label: 'Status', value: data?.subscription_status || 'Unknown' },
      { label: 'Valid Until', value: data?.valid_until || 'Not available' },
    ],
  },
];

const buildPodcastListSection = (data) => {
  const items = normalizeArray(data?.items).map((item) => ({
    id: item?.id || null,
    title: item?.title || 'Podcast',
    host: item?.host || null,
    category: item?.category || null,
    duration: item?.duration || null,
    accessType: item?.access_type || null,
    description: toSentence(item?.description),
  }));

  if (items.length === 0) {
    return [];
  }

  return [
    {
      kind: 'podcast_list',
      title: 'Podcasts',
      items,
    },
  ];
};

const buildSupportListSection = (toolName, data) => {
  const items = normalizeArray(data?.items).map((item) => ({
    id: item?.id || null,
    title: item?.title || item?.subject || 'Support item',
    type: item?.type || null,
    status: item?.status || null,
    content: toSentence(item?.content),
    updatedAt: item?.updated_at || item?.updatedAt || null,
  }));

  if (items.length === 0) {
    return [];
  }

  return [
    {
      kind: 'support_list',
      title: toolName === 'get_support_messages' ? 'Your Support Messages' : 'Helpful Support Information',
      items,
    },
  ];
};

const buildCourseProgressSection = (data) => [
  {
    kind: 'progress_card',
    title: data?.course_title ? `${data.course_title} Progress` : 'Course Progress',
    progress: typeof data?.percentage === 'number' ? data.percentage : 0,
    rows: [
      { label: 'Completion', value: `${data?.percentage ?? 0}%` },
      { label: 'Completed', value: data?.is_completed ? 'Yes' : 'No' },
      { label: 'Videos', value: `${normalizeArray(data?.completed_videos).length}/${data?.total_videos ?? 0}` },
      { label: 'PDFs', value: `${normalizeArray(data?.completed_pdfs).length}/${data?.total_pdfs ?? 0}` },
      ...(typeof data?.current_video_index === 'number'
        ? [{ label: 'Current Lesson', value: `Lesson ${data.current_video_index + 1}` }]
        : []),
      ...(data?.last_accessed_at ? [{ label: 'Last Active', value: 'Recently active' }] : []),
    ],
  },
];

const buildCourseComparisonSection = (data) => {
  const items = normalizeArray(data?.items).map((item) => ({
    id: item?.id || null,
    title: item?.title || 'Untitled course',
    category: item?.category || null,
    duration: item?.duration || null,
    description: toSentence(item?.description),
    status: item?.status || null,
    progressLabel:
      typeof item?.progress === 'number'
        ? `${Math.round(item.progress)}% progress`
        : null,
    completionLabel: item?.is_completed ? 'Completed' : null,
    videoCountLabel:
      typeof item?.total_videos === 'number' && item.total_videos > 0
        ? `${item.total_videos} videos`
        : null,
    pdfCountLabel:
      typeof item?.total_pdfs === 'number' && item.total_pdfs > 0
        ? `${item.total_pdfs} PDFs`
        : null,
    lastAccessedLabel: item?.last_accessed_at ? 'Recently active' : null,
  }));

  if (!items.length && !normalizeArray(data?.rows).length) {
    return [];
  }

  return [
    {
      kind: 'comparison_card',
      title: 'Course Comparison',
      status: data?.focus || 'comparison',
      comparisonMode: 'course',
      rows: normalizeArray(data?.rows),
      items,
      recommendedId: data?.recommended_course_id || null,
      recommendedTitle: data?.recommended_course_title || null,
    },
  ];
};

const buildActionResultSection = (toolName, result) => {
  const data = result?.data || {};
  const event = data?.event || {};

  if (toolName === 'register_for_event') {
    const paymentUrl = data?.payment_url || null;
    const paymentRequired = !!data?.payment_required;
    const isTestMode = !!data?.is_test_mode;
    const alreadyRegistered = data?.action === 'already_registered';
    const paymentPending = data?.action === 'payment_pending';
    const verificationPending = data?.action === 'registration_pending_verification';
    const registrationClosed = data?.action === 'registration_closed';
    const registrationFull = data?.action === 'registration_full';
    const missingProfileInfo = data?.action === 'missing_profile_info';
    const shouldRenderPaymentCard = paymentRequired && !!paymentUrl;

    if (shouldRenderPaymentCard) {
      return [
        {
          kind: 'payment_card',
          title: isTestMode ? 'Complete Test Payment' : 'Complete Event Payment',
          status: data?.status || 'pending_payment',
          message: result?.summary || data?.message || 'Your event payment link is ready.',
          rows: [
            { label: 'Event', value: event?.title || data?.event_title || data?.event_id || 'Selected event' },
            { label: 'Date', value: event?.event_date || 'Not available' },
            { label: 'Time', value: event?.event_time || event?.start_time || 'Not available' },
            { label: 'Location', value: event?.location || 'Not available' },
            { label: 'Amount', value: formatCurrency(data?.payment_amount ?? event?.price, event?.currency || 'INR') },
          ],
          paymentUrl,
          paymentRequired: true,
          tone: 'orange',
          icon: 'card-outline',
          animation: 'settled',
          ctaLabel: isTestMode ? 'Complete Test Payment' : 'Pay Securely',
          ctaType: 'event_payment',
          ctaPayload: {
            eventId: data?.event_id || event?.id || null,
            paymentLinkId: data?.payment_link_id || null,
            paymentUrl,
            isTestMode,
          },
        },
      ];
    }

    let title = 'Event Registration Updated';
    let status = data?.status || 'confirmed';
    let tone = 'green';
    let icon = 'checkmark-circle-outline';
    let animation = 'success';

    if (verificationPending) {
      title = 'Registration In Review';
      status = data?.status || 'verification_pending';
      tone = 'orange';
      icon = 'time-outline';
      animation = 'pending';
    } else if (paymentPending) {
      title = 'Payment Pending';
      status = data?.status || 'pending_payment';
      tone = 'orange';
      icon = 'card-outline';
      animation = 'settled';
    } else if (alreadyRegistered) {
      title = 'Already Registered';
      tone = 'blue';
      icon = 'checkmark-done-outline';
      animation = 'settled';
    } else if (registrationFull) {
      title = 'Event Is Full';
      status = 'closed';
      tone = 'orange';
      icon = 'people-outline';
      animation = 'settled';
    } else if (registrationClosed) {
      title = 'Registration Closed';
      status = 'closed';
      tone = 'red';
      icon = 'lock-closed-outline';
      animation = 'settled';
    } else if (missingProfileInfo) {
      title = 'Need A Few Details';
      status = 'blocked';
      tone = 'orange';
      icon = 'person-outline';
      animation = 'settled';
    }

    const rows = [
      { label: 'Event', value: event?.title || data?.event_title || data?.event_id || 'Selected event' },
      { label: 'Date', value: event?.event_date || 'Not available' },
      { label: 'Time', value: event?.event_time || event?.start_time || 'Not available' },
      { label: 'Location', value: event?.location || 'Not available' },
    ];

    if (Array.isArray(data?.missing_fields) && data.missing_fields.length) {
      rows.push({ label: 'Needed', value: data.missing_fields.join(', ') });
    }

    if (data?.ticket_id) {
      rows.push({ label: 'Ticket', value: data.ticket_id });
    }

    return [
      {
        kind: 'action_status',
        title,
        status,
        message: result?.summary || data?.message || 'Event action completed.',
        rows,
        tone,
        icon,
        animation,
      },
    ];
  }

  if (toolName === 'cancel_event_registration') {
    const notFound = data?.action === 'registration_not_found' || data?.status === 'not_found';
    const needsAttention = data?.action === 'cancellation_needs_attention';
    const alreadyCancelled = data?.action === 'registration_already_cancelled';
    const verificationPending = data?.action === 'cancellation_pending_verification';
    const unavailable = data?.action === 'cancellation_unavailable' || data?.status === 'failed';
    return [
      {
        kind: 'action_status',
        title: verificationPending
          ? 'Cancellation In Review'
          : needsAttention
            ? 'Cancellation Needs Attention'
            : unavailable
              ? 'Cancellation Unavailable'
              : alreadyCancelled
                ? 'Already Cancelled'
                : notFound
                  ? 'No Active Registration Found'
                  : 'Event Registration Cancelled',
        status: data?.status || (verificationPending ? 'verification_pending' : unavailable ? 'failed' : 'cancelled'),
        message: result?.summary || data?.message || (notFound ? 'No active registration was found for this event.' : 'Your event registration was cancelled.'),
        rows: [
          { label: 'Event', value: event?.title || data?.event_title || data?.event_id || 'Selected event' },
        ],
        tone: verificationPending || needsAttention ? 'orange' : unavailable ? 'red' : notFound ? 'neutral' : 'blue',
        icon: verificationPending
          ? 'time-outline'
          : needsAttention
            ? 'alert-circle-outline'
            : unavailable
              ? 'alert-circle-outline'
              : notFound
                ? 'help-circle-outline'
                : alreadyCancelled
                  ? 'checkmark-done-outline'
                  : 'close-circle-outline',
        animation: verificationPending || needsAttention ? 'pending' : 'settled',
      },
    ];
  }

  if (toolName === 'enroll_in_course') {
    const course = data?.course || {};
    const needsUpgrade = !!data?.upgrade_required;
    const action = data?.action || null;
    const isConfirmationRequired = action === 'confirmation_required';
    const isAlreadyEnrolled = action === 'already_enrolled';
    const isRestrictedPlan = action === 'restricted_plan';
    const isUnavailable = action === 'course_unavailable';
    const isVerificationPending = action === 'enrollment_pending_verification';
    const sections = [];

    sections.push({
      kind: 'action_status',
      title:
        isConfirmationRequired
          ? 'Ready To Enroll'
          : needsUpgrade
            ? 'Enrollment Needs Plan Access'
            : isAlreadyEnrolled
              ? 'Already Enrolled'
              : isUnavailable
                ? 'Course Unavailable'
                : isVerificationPending
                  ? 'Enrollment Submitted'
                  : 'Course Enrollment',
      status:
        data?.status ||
        (isConfirmationRequired
          ? 'confirmation_required'
          : needsUpgrade
            ? 'blocked'
            : isAlreadyEnrolled
              ? 'already_enrolled'
              : isUnavailable
                ? 'unavailable'
                : isVerificationPending
                  ? 'verification_pending'
                  : 'enrolled'),
      message: data?.message || result?.summary || 'Course action updated.',
      rows: [
        { label: 'Course', value: course?.title || data?.course_id || 'Selected course' },
        { label: 'Category', value: course?.category || 'Not available' },
        { label: 'Duration', value: course?.duration || 'Not available' },
        { label: 'Videos', value: String(course?.total_videos ?? 'Not available') },
        { label: 'PDFs', value: String(course?.total_pdfs ?? 'Not available') },
      ],
      tone:
        isConfirmationRequired
          ? 'blue'
          : needsUpgrade
            ? 'orange'
            : isUnavailable
              ? 'red'
              : isVerificationPending
                ? 'neutral'
                : 'green',
      icon:
        isConfirmationRequired
          ? 'help-circle-outline'
          : needsUpgrade
            ? 'lock-closed-outline'
            : isAlreadyEnrolled
              ? 'checkmark-done-outline'
              : isUnavailable
                ? 'alert-circle-outline'
                : 'book-outline',
      animation:
        isConfirmationRequired || needsUpgrade || isVerificationPending
          ? 'pending'
          : 'success',
      ctaLabel: needsUpgrade ? 'View Membership Plans' : null,
      ctaType: needsUpgrade ? 'navigate_membership' : null,
      ctaPayload: needsUpgrade ? { route: '/(home)/my-membership' } : null,
    });

    if (needsUpgrade && Array.isArray(data?.membership_plans) && data.membership_plans.length > 0) {
      sections.push(
        ...buildMembershipListSection({
          items: data.membership_plans,
        })
      );
    }

    return sections;
  }

  if (toolName === 'play_current_lesson') {
    const course = data?.course || {};
    const lesson = data?.lesson || {};
    const action = data?.action || null;
    const destination = data?.destination || null;
    const canNavigate = !!destination?.route;
    const isNoEnrollments = action === 'no_enrollments';
    const isNotEnrolled = action === 'not_enrolled_in_course';
    const needsSelection = action === 'course_selection_required';
    const isCompleted = action === 'course_completed';
    const isUnavailable = action === 'lesson_unavailable' || action === 'lesson_playback_unavailable' || action === 'course_unavailable';
    const canDirectPlay = data?.can_direct_play === true;

    return [
      {
        kind: 'action_status',
        title:
          isNoEnrollments
            ? 'No Enrolled Courses Yet'
            : isNotEnrolled
              ? 'Enrollment Required'
              : needsSelection
                ? 'Choose A Course'
                : isCompleted
                  ? 'Course Completed'
                  : isUnavailable
                    ? 'Lesson Unavailable'
                    : canDirectPlay
                      ? 'Current Lesson Ready'
                      : 'Open Current Course',
        status:
          data?.status ||
          (isNoEnrollments
            ? 'not_enrolled'
            : isNotEnrolled
              ? 'not_enrolled'
              : needsSelection
                ? 'selection_required'
                : isCompleted
                  ? 'completed'
                  : isUnavailable
                    ? 'unavailable'
                    : 'ready'),
        message: data?.message || result?.summary || 'Course lesson action updated.',
        rows: [
          { label: 'Course', value: course?.title || data?.course_id || 'Selected course' },
          { label: 'Lesson', value: lesson?.title || (isCompleted ? 'All lessons completed' : 'Current lesson') },
          { label: 'Progress', value: typeof data?.progress?.percentage === 'number' ? `${data.progress.percentage}%` : 'Not available' },
          { label: 'Lesson Duration', value: lesson?.duration || 'Not available' },
        ],
        tone:
          isUnavailable
            ? 'red'
            : isNoEnrollments || needsSelection
              ? 'neutral'
              : isNotEnrolled
                ? 'orange'
                : isCompleted
                  ? 'green'
                  : 'blue',
        icon:
          isNoEnrollments
            ? 'book-outline'
            : isNotEnrolled
              ? 'lock-closed-outline'
              : needsSelection
                ? 'help-circle-outline'
                : isCompleted
                  ? 'checkmark-done-outline'
                  : isUnavailable
                    ? 'alert-circle-outline'
                    : canDirectPlay
                      ? 'play-circle-outline'
                      : 'open-outline',
        animation: 'settled',
        ctaLabel: canNavigate ? (canDirectPlay ? 'Play Current Lesson' : 'Open Course') : null,
        ctaType: canNavigate ? 'course_playback' : null,
        ctaPayload: canNavigate ? destination : null,
      },
    ];
  }

  if (toolName === 'complete_course') {
    const course = data?.course || {};
    const isAlreadyCompleted = data?.action === 'already_completed';
    const isConfirmationRequired = data?.action === 'confirmation_required';

    return [
      {
        kind: 'action_status',
        title: isAlreadyCompleted
          ? 'Already Completed'
          : isConfirmationRequired
            ? 'Confirm Completion'
            : 'Course Completed!',
        status: isAlreadyCompleted
          ? 'completed'
          : isConfirmationRequired
            ? 'confirm'
            : 'success',
        message: data?.message || result?.summary || 'Course progress updated.',
        rows: [
          { label: 'Course', value: course?.title || data?.course_id || 'Selected course' },
          { label: 'Progress', value: '100% completed' },
          { label: 'Videos Done', value: String(data?.completed_videos_count ?? 'All') },
          { label: 'PDFs Done', value: String(data?.completed_pdfs_count ?? 'All') },
        ],
        tone: isConfirmationRequired ? 'blue' : 'green',
        icon: isConfirmationRequired
          ? 'help-circle-outline'
          : 'checkmark-done-outline',
        animation: 'settled',
      }
    ];
  }

  if (toolName === 'start_membership_purchase') {
    if (data?.action === 'membership_purchase_unavailable' || data?.status === 'failed') {
      return [
        {
          kind: 'action_status',
          title: 'Membership Purchase Unavailable',
          status: 'failed',
          message: data?.message || result?.summary || 'I could not start the membership purchase right now.',
          rows: [
            { label: 'Plan', value: String(data?.plan || 'Membership').toUpperCase() },
            { label: 'Variant', value: data?.variant_slug || 'Default' },
          ],
          tone: 'red',
          icon: 'alert-circle-outline',
          animation: 'settled',
        },
      ];
    }

    return [
      {
        kind: 'payment_card',
        title: 'Complete Membership Payment',
        status: 'pending_payment',
        message: result?.summary || data?.message || 'Your membership payment link is ready.',
        rows: [
          { label: 'Plan', value: String(data?.plan || 'Membership').toUpperCase() },
          { label: 'Variant', value: data?.variant_slug || 'Default' },
        ],
        paymentUrl: data?.payment_url || null,
        paymentRequired: true,
        tone: 'orange',
        icon: 'card-outline',
        animation: 'payment',
        ctaLabel: 'Pay Securely',
        ctaType: 'membership_payment',
        ctaPayload: {
          plan: data?.plan || null,
          variantSlug: data?.variant_slug || null,
          paymentLinkId: data?.payment_link_id || null,
          paymentUrl: data?.payment_url || null,
        },
      },
    ];
  }

  if (toolName === 'book_counseling_session') {
    const action = data?.action;
    const isConfirmationRequired = action === 'confirmation_required';
    const isPaymentLinkCreated = action === 'payment_link_created';
    const isConfirmed = action === 'booking_confirmed';

    if (isPaymentLinkCreated) {
      return [
        {
          kind: 'payment_card',
          title: 'Complete Session Payment',
          status: 'pending_payment',
          message: result?.summary || data?.message || 'Payment link generated for session booking.',
          rows: [
            { label: 'Service', value: data?.counselor_type || 'Counseling Session' },
            { label: 'Date', value: data?.booking_date },
            { label: 'Time', value: data?.booking_time },
            { label: 'Price', value: `₹${data?.amount}` },
          ],
          paymentUrl: data?.payment_url || null,
          paymentRequired: true,
          tone: 'orange',
          icon: 'card-outline',
          animation: 'payment',
          ctaLabel: 'Pay Securely',
          ctaType: 'booking_payment',
          ctaPayload: {
            bookingId: data?.booking_id || null,
            paymentLinkId: data?.payment_link_id || null,
            paymentUrl: data?.payment_url || null,
          },
        },
      ];
    }

    return [
      {
        kind: 'action_status',
        title: isConfirmationRequired
          ? 'Confirm Session Booking'
          : isConfirmed
            ? 'Session Booking Confirmed!'
            : 'Booking Status Update',
        status: isConfirmationRequired
          ? 'confirm'
          : isConfirmed
            ? 'success'
            : 'pending',
        message: result?.summary || data?.message || 'Booking action updated.',
        rows: [
          { label: 'Service', value: data?.counselor_type || 'Counseling Session' },
          { label: 'Counselor', value: data?.counselor_name || 'Expert Counselor' },
          { label: 'Date', value: data?.booking_date },
          { label: 'Time', value: data?.booking_time },
          { label: 'Price', value: data?.is_free ? 'Free' : `₹${data?.price}` },
        ],
        tone: isConfirmationRequired ? 'blue' : 'green',
        icon: isConfirmationRequired ? 'help-circle-outline' : 'checkmark-circle-outline',
        animation: 'settled',
      },
    ];
  }

  if (toolName === 'cancel_counseling_booking') {
    const action = data?.action;
    const isConfirmationRequired = action === 'confirmation_required';
    const isCancelled = action === 'booking_cancelled' || action === 'already_cancelled';

    return [
      {
        kind: 'action_status',
        title: isConfirmationRequired
          ? 'Confirm Cancellation'
          : 'Booking Cancelled',
        status: isConfirmationRequired ? 'confirm' : 'cancelled',
        message: result?.summary || data?.message || 'Cancellation request processed.',
        rows: [
          { label: 'Service', value: data?.counselor_type || 'Counseling Session' },
          { label: 'Date', value: data?.booking_date },
          { label: 'Time', value: data?.booking_time },
        ],
        tone: isConfirmationRequired ? 'orange' : 'neutral',
        icon: isConfirmationRequired ? 'help-circle-outline' : 'close-circle-outline',
        animation: 'settled',
      },
    ];
  }

  if (toolName === 'create_community_post') {
    const post = data?.post || {};
    const action = data?.action || null;
    const isConfirmationRequired = action === 'confirmation_required';
    const isGroupSelectionRequired = action === 'group_selection_required';
    const isMissingContent = action === 'missing_content';
    const isVerificationPending = action === 'post_pending_verification';
    const publishedContent = data?.content || post?.content || '';
    const formattedTags = Array.isArray(data?.tags) && data.tags.length
      ? data.tags.map((tag) => `#${tag}`).join(', ')
      : null;

    return [
      {
        kind: 'action_status',
        title:
          isConfirmationRequired
            ? 'Ready To Publish'
            : isGroupSelectionRequired
              ? 'Choose Community Group'
              : isMissingContent
                ? 'Need Post Content'
                : isVerificationPending
                  ? 'Post Submitted'
                  : 'Post Published',
        status:
          data?.status ||
          (isConfirmationRequired
            ? 'confirmation_required'
            : isGroupSelectionRequired
              ? 'selection_required'
              : isMissingContent
                ? 'blocked'
                : isVerificationPending
                  ? 'verification_pending'
                  : 'published'),
        message:
          data?.message ||
          result?.summary ||
          (isConfirmationRequired
            ? 'Review this post before publishing it in the community.'
            : isVerificationPending
              ? 'Your post has been submitted and is being checked before it appears publicly.'
              : 'Your post is now live in the community.'),
        rows: [
          { label: 'Community', value: data?.group_name || data?.group_id || 'Selected community' },
          ...(formattedTags ? [{ label: 'Tags', value: formattedTags }] : []),
        ],
        tone:
          isConfirmationRequired
            ? 'blue'
            : isGroupSelectionRequired || isMissingContent
              ? 'orange'
              : isVerificationPending
                ? 'neutral'
                : 'green',
        icon:
          isConfirmationRequired
            ? 'create-outline'
            : isGroupSelectionRequired
              ? 'people-outline'
              : isMissingContent
                ? 'document-text-outline'
                : 'checkmark-circle-outline',
        animation: isConfirmationRequired || isGroupSelectionRequired || isMissingContent ? 'pending' : 'settled',
        ctaLabel: isConfirmationRequired ? 'Publish Post' : null,
        ctaType: isConfirmationRequired ? 'confirm_community_post' : null,
        ctaPayload: isConfirmationRequired
          ? {
              groupId: data?.group_id,
              groupName: data?.group_name,
              content: data?.content,
              tags: data?.tags || [],
            }
          : null,
        metadata: {
          communityActionKind: 'community_post',
          communityName: data?.group_name || data?.group_id || null,
          contentPreview: publishedContent || null,
          tagsLabel: formattedTags,
          isConfirmationRequired,
          isVerificationPending,
        },
      },
    ];
  }

  if (toolName === 'create_post_comment') {
    const comment = data?.comment || {};
    const action = data?.action || null;
    const isConfirmationRequired = action === 'confirmation_required';
    const isPostSelectionRequired = action === 'post_selection_required';
    const isMissingContent = action === 'missing_content';
    const isVerificationPending = action === 'comment_pending_verification';
    const replyContent = data?.content || comment?.content || '';
    const postContent = data?.post_content || '';

    return [
      {
        kind: 'action_status',
        title:
          isConfirmationRequired
            ? 'Ready To Reply'
            : isPostSelectionRequired
              ? 'Choose A Post'
              : isMissingContent
                ? 'Need Reply Content'
                : isVerificationPending
                  ? 'Reply Submitted'
                  : 'Reply Published',
        status:
          data?.status ||
          (isConfirmationRequired
            ? 'confirmation_required'
            : isPostSelectionRequired
              ? 'selection_required'
              : isMissingContent
                ? 'blocked'
                : isVerificationPending
                  ? 'verification_pending'
                  : 'published'),
        message:
          data?.message ||
          result?.summary ||
          (isConfirmationRequired
            ? 'Review this reply before publishing it on the post.'
            : isVerificationPending
              ? 'Your reply has been submitted and is waiting to appear on the post.'
              : 'Your reply has been published on the post.'),
        rows: [
          ...(postContent ? [{ label: 'Post', value: postContent }] : []),
        ],
        tone:
          isConfirmationRequired
            ? 'blue'
            : isPostSelectionRequired || isMissingContent
              ? 'orange'
              : isVerificationPending
                ? 'neutral'
                : 'green',
        icon:
          isConfirmationRequired
            ? 'chatbubble-ellipses-outline'
            : isPostSelectionRequired
              ? 'help-circle-outline'
              : isMissingContent
                ? 'create-outline'
                : 'checkmark-circle-outline',
        animation: isConfirmationRequired || isPostSelectionRequired || isMissingContent ? 'pending' : 'settled',
        ctaLabel: isConfirmationRequired ? 'Post Reply' : null,
        ctaType: isConfirmationRequired ? 'confirm_post_comment' : null,
        ctaPayload: isConfirmationRequired
          ? {
              postId: data?.post_id,
              postContent: data?.post_content,
              content: data?.content,
            }
          : null,
        metadata: {
          communityActionKind: 'post_reply',
          targetPreview: postContent || null,
          contentPreview: replyContent || null,
          isConfirmationRequired,
          isVerificationPending,
        },
      },
    ];
  }

  if (toolName === 'like_community_post') {
    const action = data?.action || null;
    const needsAttention = action === 'like_state_needs_attention';
    const requiresPostSelection = action === 'post_selection_required';
    const alreadyLiked = action === 'already_liked';
    const alreadyUnliked = action === 'already_unliked';
    const liked = action === 'post_liked';

    return [
      {
        kind: 'action_status',
        title:
          requiresPostSelection
            ? 'Choose A Post'
            : needsAttention
              ? 'Like State Needs Attention'
              : alreadyLiked
                ? 'Already Liked'
                : alreadyUnliked
                  ? 'Already Unliked'
                  : liked
                    ? 'Post Liked'
                    : 'Like Removed',
        status:
          data?.status ||
          (requiresPostSelection
            ? 'selection_required'
            : needsAttention
              ? 'needs_attention'
              : liked || alreadyLiked
                ? 'liked'
                : 'unliked'),
        message: data?.message || result?.summary || 'Post like state updated.',
        rows: [
          { label: 'Post', value: data?.post_content || 'Selected post' },
          { label: 'Likes', value: String(data?.like_count ?? 'Not available') },
        ],
        tone: requiresPostSelection ? 'orange' : needsAttention ? 'red' : liked || alreadyLiked ? 'green' : 'blue',
        icon: requiresPostSelection ? 'help-circle-outline' : liked || alreadyLiked ? 'heart' : needsAttention ? 'alert-circle-outline' : 'heart-outline',
        animation: requiresPostSelection || needsAttention ? 'pending' : 'settled',
      },
    ];
  }

  if (toolName === 'reply_to_post_comment') {
    const comment = data?.comment || {};
    const action = data?.action || null;
    const isConfirmationRequired = action === 'confirmation_required';
    const isCommentSelectionRequired = action === 'comment_selection_required';
    const isMissingContent = action === 'missing_content';
    const isMissingPostContext = action === 'missing_post_context';
    const isVerificationPending = action === 'comment_reply_pending_verification';
    const replyContent = data?.content || comment?.content || '';
    const targetComment = data?.comment_content || '';

    return [
      {
        kind: 'action_status',
        title:
          isConfirmationRequired
            ? 'Ready To Reply To Comment'
            : isCommentSelectionRequired
              ? 'Choose A Comment'
              : isMissingContent
                ? 'Need Reply Text'
                : isMissingPostContext
                  ? 'Need Thread Context'
                  : isVerificationPending
                    ? 'Reply Submitted'
                    : 'Comment Reply Published',
        status:
          data?.status ||
          (isConfirmationRequired
            ? 'confirmation_required'
            : isCommentSelectionRequired
              ? 'selection_required'
              : isMissingContent || isMissingPostContext
                ? 'blocked'
                : isVerificationPending
                  ? 'verification_pending'
                  : 'published'),
        message:
          data?.message ||
          result?.summary ||
          (isConfirmationRequired
            ? 'Review this threaded reply before posting it.'
            : isVerificationPending
              ? 'Your threaded reply has been submitted and is waiting to appear in the conversation.'
              : 'Your threaded reply has been published in the conversation.'),
        rows: [
          ...(data?.comment_author ? [{ label: 'Replying to', value: data?.comment_author }] : []),
        ],
        tone:
          isConfirmationRequired
            ? 'blue'
            : isCommentSelectionRequired || isMissingContent || isMissingPostContext
              ? 'orange'
              : isVerificationPending
                ? 'neutral'
                : 'green',
        icon:
          isConfirmationRequired
            ? 'return-up-forward-outline'
            : isCommentSelectionRequired
              ? 'help-circle-outline'
              : isMissingContent || isMissingPostContext
                ? 'chatbubble-ellipses-outline'
                : 'checkmark-circle-outline',
        animation: isConfirmationRequired || isCommentSelectionRequired || isMissingContent || isMissingPostContext ? 'pending' : 'settled',
        ctaLabel: isConfirmationRequired ? 'Post Reply' : null,
        ctaType: isConfirmationRequired ? 'confirm_comment_reply' : null,
        ctaPayload: isConfirmationRequired
          ? {
              commentId: data?.comment_id,
              commentContent: data?.comment_content,
              content: data?.content,
            }
          : null,
        metadata: {
          communityActionKind: 'comment_reply',
          targetPreview: targetComment || null,
          targetAuthor: data?.comment_author || null,
          contentPreview: replyContent || null,
          isConfirmationRequired,
          isVerificationPending,
        },
      },
    ];
  }

  return [];
};

const buildPlayPodcastSection = (result) => {
  const data = result?.data || {};
  const action = data?.action;
  const podcast = data?.podcast || {};
  const title = podcast?.title || 'Selected Podcast';
  const host = podcast?.host || 'Expert';
  const duration = podcast?.duration || 'N/A';
  const podcastId = data?.podcast_id || podcast?.id || podcast?._id;

  if (action === 'play_confirmed') {
    return [
      {
        kind: 'action_status',
        title: 'Podcast Player Ready',
        status: 'ready',
        message: result?.summary || data?.message || 'Press Play to stream the podcast.',
        rows: [
          { label: 'Podcast', value: title },
          { label: 'Host', value: host },
          { label: 'Duration', value: duration },
        ],
        tone: 'green',
        icon: 'play-circle-outline',
        animation: 'settled',
        ctaLabel: 'Play Now',
        ctaType: 'podcast_playback',
        ctaPayload: {
          route: '/(home)/podcasts',
          params: { podcastId },
        },
      },
    ];
  }

  if (action === 'membership_required') {
    return [
      {
        kind: 'action_status',
        title: 'Premium Membership Required',
        status: 'upgrade_needed',
        message: result?.summary || data?.message || 'This podcast is available to Premium members.',
        rows: [
          { label: 'Podcast', value: title },
          { label: 'Required Access', value: 'Premium Membership' },
        ],
        tone: 'orange',
        icon: 'lock-closed-outline',
        animation: 'settled',
        ctaLabel: 'View Plans',
        ctaType: 'navigate_membership',
        ctaPayload: {
          route: '/(home)/my-membership',
        },
      },
    ];
  }

  if (action === 'payment_required') {
    return [
      {
        kind: 'action_status',
        title: 'Unlock Gated Podcast',
        status: 'gated',
        message: result?.summary || data?.message || 'This paid track needs to be purchased to unlock playback.',
        rows: [
          { label: 'Podcast', value: title },
          { label: 'Access Type', value: 'One-time Purchase' },
        ],
        tone: 'orange',
        icon: 'cart-outline',
        animation: 'settled',
        ctaLabel: 'View Podcast Details',
        ctaType: 'podcast_playback',
        ctaPayload: {
          route: '/(home)/podcasts',
          params: { podcastId },
        },
      },
    ];
  }

  // Default: confirmation required
  return [
    {
      kind: 'action_status',
      title: 'Play Spiritual Session',
      status: 'confirm',
      message: result?.summary || data?.message || 'Would you like to play this audio track?',
      rows: [
        { label: 'Podcast', value: title },
        { label: 'Host', value: host },
        { label: 'Duration', value: duration },
      ],
      tone: 'blue',
      icon: 'help-circle-outline',
      animation: 'settled',
    },
  ];
};

const buildMyCounselingBookingsSection = (data) => {
  const bookings = normalizeArray(data?.bookings).map((b) => ({
    id: b.id,
    title: b.booking_title || b.counselor_type || 'Counseling Session',
    paymentStatus: b.payment_status || 'pending',
    priceLabel: b.is_free ? 'Free' : `₹${b.amount}`,
    status: b.status || 'pending',
    date: b.booking_date,
    time: b.booking_time,
    location: b.meeting_link || 'Video Call Link will be shared before session',
  }));

  if (bookings.length === 0) {
    return [
      {
        kind: 'action_status',
        title: 'No Bookings Found',
        status: 'unavailable',
        message: 'You have no booked counseling sessions at the moment.',
        tone: 'neutral',
        icon: 'calendar-outline',
        animation: 'settled',
        rows: [],
      },
    ];
  }

  return [
    {
      kind: 'registration_list',
      title: 'Your Counseling Sessions',
      items: bookings,
    },
  ];
};


const buildCounselingServicesSection = (data) => {
  const items = normalizeArray(data?.items).map((svc) => ({
    id: svc?.id || null,
    title: svc?.title || 'Counseling Session',
    subtitle: svc?.counselor_name || 'Expert Counselor',
    description: toSentence(svc?.description),
    duration: svc?.duration || '60 mins',
    priceLabel: svc?.price_label || (svc?.is_free ? 'Free' : formatCurrency(svc?.price, 'INR')),
    isFree: !!svc?.is_free,
    icon: svc?.icon || 'help-buoy',
    color: svc?.color || '#3B82F6',
    bgColor: svc?.bg_color || '#EFF6FF',
    type: svc?.is_free ? 'Free' : 'Paid',
  }));

  if (items.length === 0) {
    return [
      {
        kind: 'action_status',
        title: 'No Services Available',
        status: 'unavailable',
        message: 'There are no counseling services available at the moment. Please check back soon.',
        tone: 'neutral',
        icon: 'calendar-outline',
        animation: 'settled',
        rows: [],
      },
    ];
  }

  return [
    {
      kind: 'counseling_list',
      title: 'Counseling & Therapy Services',
      items,
    },
  ];
};

const buildCounselorAvailabilitySection = (data) => {
  const slots = normalizeArray(data?.slots);
  const total = data?.total_slots ?? slots.length;
  const isFullyBooked = !!data?.is_fully_booked || total === 0;
  const displayDate = data?.display_date || data?.date || 'Selected date';
  const counselorType = data?.counselor_type || 'All services';

  return [
    {
      kind: 'action_status',
      title: isFullyBooked ? 'No Slots Available' : `${total} Slot${total === 1 ? '' : 's'} Available`,
      status: isFullyBooked ? 'unavailable' : 'available',
      tone: isFullyBooked ? 'neutral' : 'blue',
      icon: isFullyBooked ? 'calendar-clear-outline' : 'calendar-outline',
      animation: 'settled',
      message: isFullyBooked
        ? `There are no available slots for ${counselorType} on ${displayDate}. Try a different date.`
        : `Available booking times for ${counselorType} on ${displayDate}.`,
      rows: [
        { label: 'Date', value: displayDate },
        { label: 'Service', value: counselorType },
        { label: 'Open Slots', value: isFullyBooked ? 'None' : String(total) },
      ],
      slots: isFullyBooked ? [] : slots,
    },
  ];
};

const buildDailyGuidanceSection = (data) => {
  if (!data) return [];

  const rows = [];
  if (data.quote) {
    rows.push({
      label: 'Daily Quote',
      value: `"${data.quote.text}" — ${data.quote.author}`,
    });
    if (data.quote.translation) {
      rows.push({
        label: 'Translation',
        value: data.quote.translation,
      });
    }
  }

  if (data.affirmation) {
    rows.push({
      label: 'Affirmation',
      value: data.affirmation,
    });
  }

  if (data.horoscope) {
    rows.push({
      label: `Horoscope (${data.horoscope.sign})`,
      value: data.horoscope.reading,
    });
  }

  if (data.wellness_tip) {
    rows.push({
      label: 'Wellness Tip',
      value: data.wellness_tip,
    });
  }

  if (data.mood) {
    rows.push({
      label: 'Reflected Mood',
      value: data.mood,
    });
  }

  return [
    {
      kind: 'action_status',
      title: 'Your Daily Spiritual Guidance',
      status: 'Inspirational',
      tone: 'orange',
      icon: 'sparkles-outline',
      animation: 'settled',
      message: 'Take a moment to absorb today\'s spiritual alignment.',
      rows,
    },
  ];
};

const buildProductListSection = (data) => {
  const products = data?.items || [];
  if (products.length === 0) {
    return [
      {
        kind: 'action_status',
        title: 'Product Catalog Search',
        status: 'Empty',
        tone: 'neutral',
        icon: 'basket-outline',
        message: 'No products were found matching your filters.',
        rows: [],
      },
    ];
  }

  const items = products.map((prod) => ({
    id: prod.id,
    title: prod.name,
    description: prod.description,
    priceLabel: `₹${prod.price}`,
    mrpLabel: prod.mrp > prod.price ? `₹${prod.mrp}` : null,
    imageUrl: prod.image,
    shopName: prod.shop_name,
    category: prod.category_name,
    isOutOfStock: prod.is_out_of_stock,
    ratingLabel: prod.rating > 0 ? `${prod.rating} ★ (${prod.rating_count})` : null,
  }));

  return [
    {
      kind: 'product_list',
      title: `Matching Products (${products.length})`,
      items,
    },
  ];
};

const buildAddressListSection = (data) => {
  const addresses = data?.items || [];
  if (addresses.length === 0) {
    return [
      {
        kind: 'action_status',
        title: 'Delivery Addresses',
        status: 'Empty',
        tone: 'neutral',
        icon: 'location-outline',
        message: 'You have no saved addresses. Please add an address in your profile.',
        rows: [],
      },
    ];
  }

  const items = addresses.map((addr) => ({
    id: addr.id,
    title: addr.fullName,
    description: `${addr.addressLine1}${addr.addressLine2 ? ', ' + addr.addressLine2 : ''}, ${addr.city}, ${addr.state} - ${addr.pincode}`,
    type: addr.type,
    phone: addr.phone,
    isDefault: addr.isDefault,
  }));

  return [
    {
      kind: 'address_list',
      title: 'Select Delivery Address',
      items,
    },
  ];
};

const buildOrderListSection = (data) => {
  const orders = data?.items || [];
  if (orders.length === 0) {
    return [
      {
        kind: 'action_status',
        title: 'Order History',
        status: 'Empty',
        tone: 'neutral',
        icon: 'basket-outline',
        message: 'You have not placed any orders yet.',
        rows: [],
      },
    ];
  }

  const items = orders.map((ord) => {
    const itemNames = (ord.items || []).map((i) => `${i.productName} (x${i.quantity})`).join(', ');
    return {
      id: ord.id,
      title: `Order #${ord.orderNumber}`,
      description: itemNames || 'No items description',
      priceLabel: `₹${ord.pricing?.total || 0}`,
      status: ord.status,
      paymentStatus: ord.payment?.status || 'pending',
      date: ord.createdAt,
    };
  });

  return [
    {
      kind: 'order_list',
      title: 'My Orders',
      items,
    },
  ];
};

const buildOrderSummarySection = (data) => {
  if (!data) return [];
  
  if (data.action === 'confirmation_required') {
    return [
      {
        kind: 'order_summary',
        title: 'Confirm Purchase',
        ctaType: 'confirm_order',
        ctaLabel: 'Place Order',
        metadata: {
          productId: data.product_id,
          productName: data.product_name,
          quantity: data.quantity,
          price: data.price,
          addressId: data.address?.id,
          paymentMethod: data.payment_method,
          customerNotes: data.customer_notes
        },
        rows: [
          { label: 'Product', value: `${data.product_name} (x${data.quantity})` },
          { label: 'Delivery Address', value: `${data.address?.fullName}, ${data.address?.addressLine1}, ${data.address?.city}` },
          { label: 'Payment Method', value: data.payment_method === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Razorpay)' },
          { label: 'Price Per Unit', value: `₹${data.price}` },
          { label: 'Subtotal', value: `₹${data.subtotal.toFixed(2)}` },
          { label: 'GST (18%)', value: `₹${data.tax.toFixed(2)}` },
          { label: 'Shipping', value: data.shipping > 0 ? `₹${data.shipping.toFixed(2)}` : 'Free' },
          { label: 'Total Amount', value: `₹${data.total.toFixed(2)}` }
        ]
      }
    ];
  }

  if (data.action === 'order_confirmed') {
    const isOnline = data.payment_method === 'razorpay';
    return [
      {
        kind: 'order_confirmed',
        title: 'Order Confirmed',
        status: 'Success',
        tone: 'green',
        icon: 'checkmark-circle-outline',
        message: `Your order #${data.order_number} has been placed successfully.`,
        rows: [
          { label: 'Order Number', value: data.order_number },
          { label: isOnline ? 'Total Paid Online' : 'Total Paid on Delivery', value: `₹${data.total.toFixed(2)}` },
          { label: 'Delivery Estimate', value: '3 - 5 business days' }
        ]
      }
    ];
  }

  if (data.action === 'payment_required') {
    return [
      {
        kind: 'payment_link_card',
        title: 'Payment Required',
        ctaType: 'open_payment_link',
        ctaLabel: 'Pay with Razorpay',
        paymentUrl: data.payment_url,
        status: 'Payment Pending',
        tone: 'orange',
        icon: 'card-outline',
        message: 'Please complete payment using the link below to confirm your order.',
        rows: [
          { label: 'Order Number', value: data.order_number },
          { label: 'Total Amount', value: `₹${data.total.toFixed(2)}` }
        ]
      }
    ];
  }

  return [];
};

const buildCancelOrderSection = (data) => {
  if (!data) return [];

  if (data.action === 'confirmation_required') {
    return [
      {
        kind: 'order_summary',
        title: 'Cancel Order Confirmation',
        ctaType: 'confirm_order_cancellation',
        ctaLabel: 'Confirm Cancellation',
        tone: 'orange',
        metadata: {
          orderId: data.order_id,
          orderNumber: data.order_number,
          reason: data.reason
        },
        rows: [
          { label: 'Order Number', value: `#${data.order_number}` },
          { label: 'Cancellation Reason', value: data.reason }
        ]
      }
    ];
  }

  if (data.action === 'cancelled') {
    return [
      {
        kind: 'order_confirmed',
        title: 'Order Cancelled',
        status: 'Cancelled',
        tone: 'red',
        icon: 'close-circle-outline',
        message: `Your order #${data.order_number} has been cancelled successfully.`,
        rows: [
          { label: 'Order Number', value: `#${data.order_number}` },
          { label: 'Status', value: 'Cancelled' }
        ]
      }
    ];
  }

  return [];
};

const buildGroupListSection = (data) => {
  if (!data) return [];
  const planGroups = data.plan_groups || [];
  const flatGroups = data.groups || [];
  const otherGroups = data.other_groups || [];

  const items = [];

  planGroups.forEach((pg) => {
    items.push({
      id: pg._id,
      title: pg.name,
      description: pg.description || '',
      memberCount: pg.memberCount || 0,
      groupType: pg.groupType,
      planSlug: pg.planSlug,
      subgroups: (pg.subgroups || []).map((sub) => ({
        id: sub.id || sub._id,
        title: sub.name,
        description: sub.description || '',
        memberCount: sub.memberCount || 0,
        groupType: sub.groupType,
        category: sub.category
      }))
    });
  });

  otherGroups.forEach((og) => {
    items.push({
      id: og.id || og._id,
      title: og.name,
      description: og.description || '',
      memberCount: og.memberCount || 0,
      groupType: og.groupType || 'course'
    });
  });

  if (items.length === 0) {
    flatGroups.forEach((fg) => {
      items.push({
        id: fg.id || fg._id,
        title: fg.name,
        description: fg.description || '',
        memberCount: fg.memberCount || 0,
        groupType: fg.groupType || 'course'
      });
    });
  }

  return [
    {
      kind: 'group_list',
      title: 'Community Groups',
      items,
    }
  ];
};

const buildPostListSection = (data) => {
  if (!data) return [];
  const posts = data.posts || [];

  const items = posts.map((post) => {
    const author = post.author || {};
    return {
      id: post._id,
      content: post.content,
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      isPinned: !!post.isPinned,
      userLiked: !!post.userLiked,
      authorName: author.displayName || 'Anonymous User',
      authorPhoto: author.photoURL || null,
      authorPlan: author.subscriptionPlan || null,
      tags: post.tags || [],
      groupId: post.groupId,
      groupName: data.group_name || data.groupName || null,
      date: post.createdAt,
    };
  });

  return [
    {
      kind: 'post_list',
      title: data.group_name ? `${data.group_name} Discussions` : data.is_combined ? 'Combined Community Feed' : 'Discussion Feed',
      metadata: {
        groupId: data.group_id || null,
        groupName: data.group_name || null,
      },
      items,
    }
  ];
};

const buildCommentListSection = (data) => {
  if (!data) return [];
  const comments = normalizeArray(data.comments);

  const items = comments.map((comment) => {
    const author = comment.author || {};
    return {
      id: comment._id || comment.id,
      content: comment.content || '',
      likeCount: comment.likeCount || 0,
      userLiked: !!comment.userLiked,
      authorName: author.displayName || 'Anonymous User',
      authorPhoto: author.photoURL || null,
      authorPlan: author.subscriptionPlan || null,
      date: comment.createdAt,
    };
  });

  return [
    {
      kind: 'comment_list',
      title: 'Discussion Replies',
      metadata: {
        postId: data.post_id || null,
        postContent: data.post_content || null,
        totalComments: data.total_comments || items.length,
      },
      items,
    }
  ];
};

const buildAddressFormSection = (data) => {
  return [
    {
      kind: 'address_form',
      title: 'Add New Delivery Address',
      ctaType: 'submit_address_form',
      ctaLabel: 'Save and Select Address',
      tone: 'orange',
      icon: 'map-outline',
    }
  ];
};

const toolSectionBuilders = {
  search_courses: (toolCall) => buildCourseListSection('search_courses', toolCall?.result?.data),
  recommend_courses: (toolCall) => buildCourseListSection('recommend_courses', toolCall?.result?.data),
  compare_courses: (toolCall) => buildCourseComparisonSection(toolCall?.result?.data),
  get_my_enrollments: (toolCall) => buildEnrollmentOverviewSection(toolCall?.result?.data),
  get_continue_learning: (toolCall) => buildCourseListSection('get_continue_learning', toolCall?.result?.data),
  search_events: (toolCall) => buildEventListSection(toolCall?.result?.data),
  compare_events: (toolCall) => buildEventComparisonSection(toolCall?.result?.data),
  get_event_details: (toolCall) => buildEventDetailSection(toolCall?.result?.data),
  get_my_event_registrations: (toolCall) => buildRegistrationListSection(toolCall?.result?.data),
  get_membership_plans: (toolCall) => buildMembershipListSection(toolCall?.result?.data),
  get_my_subscription: (toolCall) => buildSubscriptionSection(toolCall?.result?.data),
  search_podcasts: (toolCall) => buildPodcastListSection(toolCall?.result?.data),
  search_support_content: (toolCall) => buildSupportListSection('search_support_content', toolCall?.result?.data),
  get_support_messages: (toolCall) => buildSupportListSection('get_support_messages', toolCall?.result?.data),
  get_course_progress: (toolCall) => buildCourseProgressSection(toolCall?.result?.data),
  get_course_details: (toolCall) => {
    const data = toolCall?.result?.data || {};
    const course = data?.course || {};
    const sections = [];
    sections.push(...buildCourseListSection('get_course_details', { items: [course] }));
    if (data?.is_enrolled === true && data?.progress) {
      sections.push(...buildCourseProgressSection({
        ...data.progress,
        course_title: course.title,
      }));
    }
    return sections;
  },
  register_for_event: (toolCall) => buildActionResultSection('register_for_event', toolCall?.result),
  cancel_event_registration: (toolCall) => buildActionResultSection('cancel_event_registration', toolCall?.result),
  enroll_in_course: (toolCall) => buildActionResultSection('enroll_in_course', toolCall?.result),
  play_current_lesson: (toolCall) => buildActionResultSection('play_current_lesson', toolCall?.result),
  complete_course: (toolCall) => buildActionResultSection('complete_course', toolCall?.result),
  start_membership_purchase: (toolCall) => buildActionResultSection('start_membership_purchase', toolCall?.result),
  search_counseling_services: (toolCall) => buildCounselingServicesSection(toolCall?.result?.data),
  check_counselor_availability: (toolCall) => buildCounselorAvailabilitySection(toolCall?.result?.data),
  get_my_counseling_bookings: (toolCall) => buildMyCounselingBookingsSection(toolCall?.result?.data),
  book_counseling_session: (toolCall) => buildActionResultSection('book_counseling_session', toolCall?.result),
  cancel_counseling_booking: (toolCall) => buildActionResultSection('cancel_counseling_booking', toolCall?.result),
  play_podcast: (toolCall) => buildPlayPodcastSection(toolCall?.result),
  get_daily_guidance: (toolCall) => buildDailyGuidanceSection(toolCall?.result?.data),
  search_products: (toolCall) => buildProductListSection(toolCall?.result?.data),
  get_saved_addresses: (toolCall) => buildAddressListSection(toolCall?.result?.data),
  get_my_orders: (toolCall) => buildOrderListSection(toolCall?.result?.data),
  place_product_order: (toolCall) => buildOrderSummarySection(toolCall?.result?.data),
  cancel_order: (toolCall) => buildCancelOrderSection(toolCall?.result?.data),
  request_address_form: (toolCall) => buildAddressFormSection(toolCall?.result?.data),
  create_community_post: (toolCall) => buildActionResultSection('create_community_post', toolCall?.result),
  create_post_comment: (toolCall) => buildActionResultSection('create_post_comment', toolCall?.result),
  like_community_post: (toolCall) => buildActionResultSection('like_community_post', toolCall?.result),
  reply_to_post_comment: (toolCall) => buildActionResultSection('reply_to_post_comment', toolCall?.result),
  get_community_groups: (toolCall) => buildGroupListSection(toolCall?.result?.data),
  get_community_posts: (toolCall) => buildPostListSection(toolCall?.result?.data),
  get_post_comments: (toolCall) => buildCommentListSection(toolCall?.result?.data),
};

export const buildToolPresentation = (toolsUsed = []) => {
  const sections = normalizeArray(toolsUsed).flatMap((toolCall) => {
    const toolName = String(toolCall?.tool_name || '').trim();
    const builder = toolSectionBuilders[toolName];
    if (!builder || toolCall?.success === false) {
      return [];
    }

    try {
      return builder(toolCall);
    } catch {
      return [];
    }
  });

  if (sections.length === 0) {
    return null;
  }

  return {
    version: 1,
    sections,
  };
};
