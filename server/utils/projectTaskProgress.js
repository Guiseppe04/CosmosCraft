const { AppError } = require('../middleware/errorHandler');
exports.normalizeTaskProgress = (task, data) => {
  let status = data.status ?? task.status ?? 'pending';
  let progress = data.progress ?? (task.status === 'completed' ? 100 : Number(task.progress || 0));
  if (data.status === 'completed' && data.progress === undefined) progress = 100;
  else if (data.status === 'pending' && data.progress === undefined) progress = 0;
  else if (data.status === 'in_progress' && progress === 100 && data.progress === undefined) progress = 0;
  if (data.progress !== undefined) {
    if ((data.status === 'completed' && progress !== 100) || (data.status === 'pending' && progress !== 0) || (data.status === 'in_progress' && progress === 100)) {
      throw new AppError('Progress must agree with the selected task status', 400);
    }
    if (data.status === undefined) status = progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending';
  }
  return { status, progress };
};
exports.taskAverageProgress = ({ total, completed, progress_total }) => total === 0 ? 0 :
  Math.min(completed === total ? 100 : 99,
    Math.round((progress_total === undefined ? completed * 100 : Number(progress_total)) / total));
