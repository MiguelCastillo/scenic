import {getIndexed3DComponents, getIndexed2DComponents} from "./geometry.js";

// prettier-ignore
test("getIndexed3DComponents", () => {
  const vertices = [
    0,  0,  0,  // vert 0
    1,  0,  0,  // vert 1
    1,  1,  0,  // vert 2
    0,  1,  0,  // vert 3
  ];

  // prettier-ignore
  const indexes = [
    0, 1, 2,  // triangle 0
    0, 2, 3,  // triangle 1
  ];

  // prettier-ignore
  expect(getIndexed3DComponents(vertices, indexes)).toEqual([
    0,  0,  0,  // vert 0 |
    1,  0,  0,  // vert 1 | triangle 0
    1,  1,  0,  // vert 2 |

    0,  0,  0,  // vert 0 |
    1,  1,  0,  // vert 2 | triangle 1
    0,  1,  0,  // vert 3 |
  ]);
});

test("getIndexed3DComponents", () => {
  // prettier-ignore
  const vertices = [
     1,  1,  1,  // vert 0
     1,  1, -1,  // vert 1
     1, -1,  1,  // vert 2
     1, -1, -1,  // vert 3
    -1,  1,  1,  // vert 4
    -1,  1, -1,  // vert 5
    -1, -1,  1,  // vert 6
    -1, -1, -1,  // vert 7
  ];

  // prettier-ignore
  const indexes = [
    0, 4, 6,  // triangle 0
    0, 6, 2,  // triangle 1
    3, 2, 6,  // triangle 2
    3, 6, 7,  // triangle 3
    7, 6, 4,  // triangle 4
    7, 4, 5,  // triangle 5
    5, 1, 3,  // triangle 6
    5, 3, 7,  // triangle 7
    1, 0, 2,  // triangle 8
    1, 2, 3,  // triangle 9
    5, 4, 0,  // triangle 10
    5, 0, 1,  // triangle 11
  ];

  // prettier-ignore
  expect(getIndexed3DComponents(vertices, indexes)).toEqual([
     1,  1,  1,  // vert 0 |
    -1,  1,  1,  // vert 4 | triangle 0
    -1, -1,  1,  // vert 6 |

     1,  1,  1,  // vert 0 |
    -1, -1,  1,  // vert 6 | triangle 1
     1, -1,  1,  // vert 2 |

     1, -1, -1,  // vert 3 |
     1, -1,  1,  // vert 2 | triangle 2
    -1, -1,  1,  // vert 6 |

     1, -1, -1,  // vert 3 |
    -1, -1,  1,  // vert 6 | triangle 3
    -1, -1, -1,  // vert 7 |

    -1, -1, -1,  // vert 7 |
    -1, -1,  1,  // vert 6 | triangle 4
    -1,  1,  1,  // vert 4 |

    -1, -1, -1,  // vert 7 |
    -1,  1,  1,  // vert 4 | triangle 5
    -1,  1, -1,  // vert 5 |

    -1,  1, -1,  // vert 5 |
     1,  1, -1,  // vert 1 | triangle 6
     1, -1, -1,  // vert 3 |

    -1,  1, -1,  // vert 5 |
     1, -1, -1,  // vert 3 | triangle 7
    -1, -1, -1,  // vert 7 |

     1,  1, -1,  // vert 1 |
     1,  1,  1,  // vert 0 | triangle 8
     1, -1,  1,  // vert 2 |

     1,  1, -1,  // vert 1 |
     1, -1,  1,  // vert 2 | triangle 9
     1, -1, -1,  // vert 3 |

    -1,  1, -1,  // vert 5 |
    -1,  1,  1,  // vert 4 | triangle 10
     1,  1,  1,  // vert 0 |

    -1,  1, -1,  // vert 5 |
     1,  1,  1,  // vert 0 | triangle 11
     1,  1, -1,  // vert 1 |
  ]);
});

test("getIndexed2dComponents", () => {
  // prettier-ignore
  const uv = [
    0.625, 1,     // vert 0
    0.625, 0.25,  // vert 1
    0.375, 0.5,   // vert 2
    0.875, 0.5,   // vert 3
    0.625, 0.75,  // vert 4
    0.375, 1,     // vert 5
    0.375, 0.75,  // vert 6
    0.625, 0,     // vert 7
    0.375, 0,     // vert 8
    0.375, 0.25,  // vert 9
    0.125, 0.5,   // vert 10
    0.875, 0.75,  // vert 11
    0.125, 0.75,  // vert 12
    0.625, 0.5,   // vert 13
  ];

  // prettier-ignore
  const indexes = [
    13, 3,
    11, 4,
    6,  4,
    0,  5,
    8,  7,
    1,  9,
    10, 2,
    6,  12,
    2,  13,
    4,  6,
    9,  1,
    13, 2,
  ];

  // prettier-ignore
  expect(getIndexed2DComponents(uv, indexes)).toEqual([
    0.625, 0.5,   // 13  | vert 0
    0.875, 0.5,   // 3   |

    0.875, 0.75,  // 11  | vert 1
    0.625, 0.75,  // 4   |

    0.375, 0.75,  // 6   | vert 2
    0.625, 0.75,  // 4   |

    0.625, 1,     // 0   | vert 3
    0.375, 1,     // 5   |

    0.375, 0,     // 8   | vert 4
    0.625, 0,     // 7   |

    0.625, 0.25,  // 1   | vert 5
    0.375, 0.25,  // 9   |

    0.125, 0.5,   // 10  | vert 6
    0.375, 0.5,   // 2   |

    0.375, 0.75,  // 6   | vert 7
    0.125, 0.75,  // 12  |

    0.375, 0.5,   // 2   | vert 8
    0.625, 0.5,   // 13  |

    0.625, 0.75,  // 4   | vert 9
    0.375, 0.75,  // 6   |

    0.375, 0.25,  // 9   | vert 10
    0.625, 0.25,  // 1   |

    0.625, 0.5,   // 13  | vert 11
    0.375, 0.5,   // 2   |
  ]);
});
