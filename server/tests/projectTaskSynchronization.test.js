const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const service = require('../services/projectService');
const schemaService = require('../services/projectTaskSchemaService');
const audit = require('../services/auditService');
const { createSubtaskSchema, updateSubtaskSchema, createMilestoneSchema } = require('../utils/validation');
const { normalizeTaskProgress } = require('../utils/projectTaskProgress');
const build = service.__testOnlyBuildProjectTaskTracking;

test('task forms validate names, clearable dates/assignees, booleans and percentage values', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  const create = createSubtaskSchema.validate({title:'QA', assigned_user_id:uuid, due_date:null, notes:'', is_customer_updatable:true});
  assert.equal(create.error, undefined);
  assert.equal(create.value.is_customer_updatable, true);
  const edit = updateSubtaskSchema.validate({title:'QA', assigned_user_id:null, due_date:'2026-10-04', status:'in_progress', progress:45, notes:'Review finish'});
  assert.equal(edit.error, undefined);
  assert.equal(edit.value.progress, 45);
  assert.equal(edit.value.assigned_user_id, null);
  assert.equal(createMilestoneSchema.validate({title:'QA',description:'Finish review',order_index:3}).error,undefined);
  for (const [data, field] of [[{title:' '},'title'],[{progress:101},'progress'],[{assigned_user_id:'invalid'},'assigned_user_id'],[{due_date:'bad date'},'due_date'],[{status:'unknown'},'status']]) {
    const result = updateSubtaskSchema.validate(data);
    assert.equal(result.error.details[0].path[0],field);
  }
});

test('total progress averages every task and permits decreases including zero', () => {
  assert.equal(build({total:3,completed:1,progress_total:150},'in_progress').progress,50);
  assert.equal(build({total:2,completed:2,progress_total:200},'in_progress').progress,100);
  assert.equal(build({total:2,completed:0,progress_total:0},'in_progress').progress,0);
  assert.equal(build({total:0,completed:0,progress_total:0},'in_progress').progress,0);
  assert.equal(build({total:2,completed:1,progress_total:100},'on_hold').status,'on_hold');
});

test('completion contributes 100 and reopening clears its completed percentage', () => {
  assert.deepEqual(normalizeTaskProgress({status:'pending',progress:0},{status:'completed'}),{status:'completed',progress:100});
  assert.deepEqual(normalizeTaskProgress({status:'completed',progress:100},{status:'pending'}),{status:'pending',progress:0});
  assert.deepEqual(normalizeTaskProgress({status:'pending',progress:0},{progress:45}),{status:'in_progress',progress:45});
  assert.throws(()=>normalizeTaskProgress({status:'pending',progress:0},{status:'completed',progress:50}),/agree/);
});

test('add and delete persist recalculated project progress in the task transaction', async () => {
  const originals = {connect:pool.connect, ensure:schemaService.ensureTaskSchema, log:audit.logProjectEvent};
  schemaService.ensureTaskSchema = async () => {};
  // logActivity writes through auditService; query mocks accept its inserts too.
  const operations = [];
  let taskCount = 2;
  let expectedProgress = 50;
  pool.connect = async () => ({query:async (sql, params) => {
    operations.push([sql,params]);
    if (sql.includes('SELECT project_id FROM project_milestones')) return {rows:[{project_id:'project'}]};
    if (sql.includes('SELECT m.project_id FROM project_subtasks')) return {rows:[{project_id:'project'}]};
    if (sql.includes('SELECT * FROM projects')) return {rows:[{project_id:'project',status:'in_progress',progress:100}]};
    if (sql.startsWith('INSERT INTO project_subtasks')) return {rows:[{subtask_id:'new-task',title:'QA'}]};
    if (sql.includes('DELETE FROM project_subtasks')) return {rows:[{subtask_id:'new-task',project_id:'project',title:'QA'}]};
    if (sql.includes('AS progress_total')) return {rows:[{total:taskCount,completed:1,progress_total:100}]};
    if (sql.includes('stage_title')) return {rows:[]};
    if (sql.includes('SET progress = $1')) assert.equal(params[0],expectedProgress);
    return {rows:[]};
  },release(){}});
  try {
    await service.addSubtask('milestone',{title:'QA',is_customer_updatable:true},'admin');
    assert.ok(operations.some(([sql])=>sql.includes('SET progress = $1')));
    assert.equal(operations.at(-1)[0],'COMMIT');
    operations.length=0; taskCount=1; expectedProgress=100;
    await service.deleteSubtask('new-task','admin');
    assert.equal(operations.at(-1)[0],'COMMIT');
    assert.ok(operations.some(([sql])=>sql.includes('SET status = CASE')));
  } finally {pool.connect=originals.connect;schemaService.ensureTaskSchema=originals.ensure;}
});

test('editing task metadata and progress saves clearable fields and synchronizes project progress', async () => {
  const original = { connect:pool.connect,query:pool.query,ensure:schemaService.ensureTaskSchema };
  schemaService.ensureTaskSchema = async () => {};
  pool.query = async () => ({rows:[]}); // legacy schema guards run before the task transaction
  const task = {subtask_id:'task',milestone_id:'milestone',project_id:'project',milestone_order:0,status:'in_progress',progress:20,assigned_user_id:'staff'};
  const statements=[];
  let projectPercent;
  pool.connect=async()=>({query:async(sql,params)=>{
    statements.push(sql);
    if(sql.includes('SELECT s.*, m.project_id')) return {rows:[{...task}]};
    if(sql.startsWith('SELECT * FROM project_subtasks')) return {rows:[{...task}]};
    if(sql.startsWith('SELECT * FROM projects')) return {rows:[{project_id:'project',status:'in_progress',progress:10}]};
    if(sql.startsWith('UPDATE project_subtasks')) {
      assert.equal(params[1],'Updated task');
      assert.equal(params[2],null);
      assert.equal(params[7],true,'explicit null clears assignee');
      assert.equal(params[8],60);
      assert.equal(params[9],true,'explicit null clears due date');
      assert.equal(params[11],true,'notes are included');
      return {rows:[{...task,progress:60,title:params[1]}]};
    }
    if(sql.includes('AS progress_total')) return {rows:[{total:2,completed:0,progress_total:60}]};
    if(sql.includes('SET progress = $1')) projectPercent=params[0];
    return {rows:[]};
  },release(){}});
  try {
    const result=await service.updateSubtaskStatus('task',{title:'Updated task',status:'in_progress',progress:60,assigned_user_id:null,due_date:null,notes:''},'admin','admin');
    assert.equal(result.progress,30);
    assert.equal(projectPercent,30);
    assert.equal(statements.at(-1),'COMMIT');
  } finally {pool.connect=original.connect;pool.query=original.query;schemaService.ensureTaskSchema=original.ensure;}
});

test('schema backfill leaves projects without tasks at zero and updates only changed totals', () => {
  const sql = require('fs').readFileSync(require('path').join(__dirname,'../migrations/37_project_task_progress.sql'),'utf8');
  assert.match(sql,/CASE WHEN COUNT\(\*\) = 0 THEN 0/);
  assert.match(sql,/p.progress IS DISTINCT FROM c.progress/);
});
