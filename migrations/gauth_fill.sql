INSERT INTO tb_gmail (email) VALUES ('nino.verify@gmail.com');
INSERT INTO tb_role (role) VALUES ('master'), ('admin'),  ('client');
INSERT INTO tb_org (org) VALUES ('org_master');

INSERT INTO tb_gmail_role_org (email_id, role_id, org_id) VALUES (
	(SELECT id FROM tb_gmail WHERE email = 'nino.verify@gmail.com'),
	(SELECT id FROM tb_role WHERE role = 'master'),
	(SELECT id FROM tb_org WHERE org = 'org_master')
);
