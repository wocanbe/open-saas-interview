import { action, page, query, route, type Spec } from "@wasp.sh/spec";

import { VideoConvertPage } from "./VideoConvertPage" with { type: "ref" };
import {
  createAnimationJob,
  getAllAnimationJobsByUser,
  getAnimationJobById,
  retryAnimationJob,
  updateAnimationJobStatus,
} from "./operations" with { type: "ref" };

export const animationSpec: Spec = [
  route(
    "VideoConvertRoute",
    "/video-convert",
    page(VideoConvertPage, { authRequired: true }),
  ),

  query(getAllAnimationJobsByUser, { entities: ["User", "AnimationJob"] }),
  query(getAnimationJobById, { entities: ["User", "AnimationJob"] }),
  
  action(createAnimationJob, { entities: ["User", "AnimationJob"] }),
  action(retryAnimationJob, { entities: ["User", "AnimationJob"] }),
  action(updateAnimationJobStatus, { entities: ["AnimationJob"] }),
];
