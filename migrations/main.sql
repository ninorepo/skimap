create table tb_location (
	id integer primary key autoincrement unique not null, 
	city text unique not null,
	latitude real not null,
	longitude real not null
);

create table tb_year (
	id integer primary key autoincrement unique not null,
	year integer not null
);

create table tb_content (
	id integer primary key autoincrement unique not null,
	year_id integer not null,
	location_id integer not null,
	title text unique not null,
	content text not null,
	foreign key (year_id) references tb_year(id),
	foreign key (location_id) references tb_location(id)
);

insert into tb_location(city, latitude, longitude) values ('jakarta', -6.1750, 106.8266);
insert into tb_year(year) values (1945);
insert into tb_content(
	year_id,
	location_id,
	title,
	content
) 
values (
	(select id from tb_year where year = 1945),
	(select id from tb_location where city = 'jakarta'),
	"Title: Percobaan Pertama",
	"Content: Percobaan Pertama"
);
