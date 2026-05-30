-- Migration: Add audit triggers for system_logs

-- Function: log job status changes
CREATE OR REPLACE FUNCTION log_job_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO system_logs (category, message, type) VALUES
      ('scheduler', 'New job created: ' || NEW.business_name || ' - ' || NEW.vertical || '/' || NEW.category, 'info');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO system_logs (category, message, type) VALUES
      ('scheduler', 'Job ' || NEW.business_name || ' status changed: ' || OLD.status || ' -> ' || NEW.status,
        CASE WHEN NEW.status = 'completed' THEN 'success' ELSE 'info' END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_job_changes ON jobs;
CREATE TRIGGER trigger_log_job_changes
  AFTER INSERT OR UPDATE OF status ON jobs
  FOR EACH ROW EXECUTE FUNCTION log_job_changes();

-- Function: log incident reports
CREATE OR REPLACE FUNCTION log_incident_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO system_logs (category, message, type) VALUES
      ('system', 'Incident reported: ' || NEW.category || ' at ' || NEW.business_name || ' (' || NEW.severity || ')', 'warning');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO system_logs (category, message, type) VALUES
      ('system', 'Incident ' || NEW.business_name || ' resolved: ' || COALESCE(NEW.resolution_notes, 'No notes'), 'success');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_incident_changes ON incident_reports;
CREATE TRIGGER trigger_log_incident_changes
  AFTER INSERT OR UPDATE OF status ON incident_reports
  FOR EACH ROW EXECUTE FUNCTION log_incident_changes();
