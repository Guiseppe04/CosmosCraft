ALTER TABLE project_subtasks ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100);
ALTER TABLE project_subtasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE project_subtasks ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE project_subtasks SET progress = 100 WHERE status = 'completed' AND progress <> 100;
WITH calculated AS (
 SELECT p.project_id, (
   SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE
     LEAST(CASE WHEN COUNT(*) = COUNT(CASE WHEN s.status='completed' THEN 1 END) THEN 100 ELSE 99 END,
       ROUND(AVG(CASE WHEN s.status = 'completed' THEN 100 ELSE s.progress END))::int)
     END
   FROM project_subtasks s JOIN project_milestones m USING(milestone_id) WHERE m.project_id = p.project_id
 ) AS progress
 FROM projects p
)
UPDATE projects p SET progress = c.progress, updated_at = now()
FROM calculated c WHERE c.project_id = p.project_id AND p.progress IS DISTINCT FROM c.progress;
