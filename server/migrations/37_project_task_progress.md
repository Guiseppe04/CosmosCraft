Project task progress migration

Run `node server/migrations/run-project-task-progress.js` from the repository root before deployment. It adds progress (0?100), due_date and notes to project_subtasks and backfills projects.progress from actual tasks. The operation is transactional and idempotent; projects with no tasks receive zero progress.

The project service also initializes this schema before project/task requests, sharing one migration promise and retrying after connection failures.

Progress is the rounded, equally weighted average of project task percentages. Completed tasks contribute 100; 100% total is reserved for projects whose tasks are all completed. Adding/removing/reopening a task can decrease progress. Mutations lock the project and persist task, milestone state, total progress and audit entries in one transaction.

Default tasks remain templates for future projects. Existing project tasks are independent copies and can be edited in Manage Tasks.
