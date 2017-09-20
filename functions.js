/*
shelljs: execute commands.
image_name: name of the image should start with username/name_of_image.
path: Path of the directory to the Dockerfile.
action: build the requested image.
*/
function BuildImage(shelljs, image_name , path){

shelljs.exec('sudo docker build -t ' + image_name + ' ' + path , {async:false}).stdout;

}
/*
shelljs: execute commands.
image_name: name of the image should start with username/name_of_image.
action: push the given image name.
*/
function PushImage(shelljs, image_name){

shelljs.exec('sudo docker push ' + image_name, {async:false}).stdout;
	
}
/*
shelljs: execute commands.
deployment_name: name of the deployment will be created.
image_name: name of the image should start with username/name_of_image.
nb_replicas: number of replicas the deployment will create.
port: port number if needed.
namespace: working space for the user.
action: run a deployment according to the given conditions.
*/
function RunDeployment(shelljs, deployment_name , image_name , nb_replicas, port, namespace){

	if(port != "")
		shelljs.exec('kubectl run ' + deployment_name + ' --image=' + image_name + ' --replicas=' + nb_replicas + ' --port=' + port + ' --namespace=' + namespace, {async:false}).stdout;
	else if (port == "")
		shelljs.exec('kubectl run ' + deployment_name + ' --image=' + image_name + ' --replicas=' + nb_replicas +  ' --namespace=' + namespace, {async:false}).stdout;
		
}
/*
shelljs: execute commands.
image_name: name of the image should start with username/name_of_image.
port: port number.
type: service type e.g. ClusterIP or NodePort.
namespace: working space for the user.
action: expose service for an existing deployment.
*/
function ExposeDeployment(shelljs, image_name, port, type, namespace){

shelljs.exec('kubectl expose deployment '+ image_name +' --port=' + port + '--type=' + type + ' --namespace=' + namespace , {silent:false}).stdout;

}
/*
shelljs: execute commands.
dir: path to directory.
fs: file system used to append and write.
action: Download files (blueprints) from GitHub and edit the files required to build Storm image.
*/
function PrepareStorm(shelljs, dir, fs){

	if (!fs.existsSync(dir))
            fs.mkdirSync(dir);//create directory if not exist.

	var zookeeper_name = req.session.microservice+"_" + req.session.username + "_" + req.session.projectname + "_ZOOKEEPER_SERVICE_HOST"; //form of the zookeeper service name
	var nimbus_name = req.session.microservice+"_" + req.session.username + "_" + req.session.projectname + "_NIMBUS_SERVICE_HOST";//form of the nimbus service name

	var capZookeeperName = zookeeper_name.toUpperCase();//capitalize zookeeper_name.
	var capNimbusName = nimbus_name.toUpperCase();//capitalize nimbus_name.
	
	req.session.zookeeperServiceHost = capZookeeperName;//saving Zookeeper_Service_Host into a session for later use.
	req.session.nimbusServiceHost = capNimbusName;//saving Nimbus_Service_Host into a session for later use.

    shelljs.exec('git clone https:\/\/github.com/Chisha14/StormTopology ' + dir, {silent:false}).stdout;//cloning blueprints from GitHub.

	var nimbus="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1}\nexec bin/storm nimbus";//writing to nimbus file.
	fs.writeFile(dir+'/Storm-Nimbus/start.sh', nimbus, function (err) {
			if (err) throw err;
			console.log('Storm-Nimbus Saved!');
    });
	
	var supervisor="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1} ${"+capNimbusName+":-$2}\nexec bin/storm supervisor";//writing to supervisor file.
	fs.writeFile(dir+'/Storm-Supervisor/start.sh', supervisor, function (err) {
			if (err) throw err;
			console.log('Storm-Supervisor Saved!');
	});

	var ui="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1} ${"+capNimbusName+":-$2}\nexec bin/storm ui";//writing to ui file.
	fs.writeFile(dir+'/Storm-UI/start.sh', ui, function (err) {
			if (err) throw err;
			console.log('Storm-UI Saved !');
	});
}

function RunStorm(shelljs, path){
	
	var microservice = req.session.microservices;
	var appname = req.session.projectname;
	var username = req.session.username;
	var name_format = microservice+'-'+username+'-'+appname;
	var nbReplicas = req.body.supervisornodes;

	BuildImage(shelljs, 'hash14/'+name_format+'-zookeeper' , path+'/Zookeeper');//Build Zookeeper
	PushImage(shelljs,'hash14/'+name_format+'-zookeeper');//Push Zookeeper

	BuildImage(shelljs, 'hash14/'+name_format+'-nimbus ' , path+'/Storm-Nimbus');//Build Zookeeper
	PushImage(shelljs,'hash14/'+name_format+'-nimbus');//Push Zookeeper

	BuildImage(shelljs, 'hash14/'+name_format+'-nimbus ' , path+'/Storm-Nimbus');//Build Nimbus
	PushImage(shelljs,'hash14/'+name_format+'-nimbus');//Push Nimbus

	BuildImage(shelljs, 'hash14/'+name_format+'-supervisor ' , path+'/Storm-Supervisor');//Build Supervisor
	PushImage(shelljs,'hash14/'+name_format+'-supervisor');//Push Supervisor

	BuildImage(shelljs, 'hash14/'+name_format+'-supervisor ' , path+'/Storm-UI');//Build UI
	PushImage(shelljs,'hash14/'+name_format+'-ui');//Push UI

	RunDeployment(shelljs, name_format + '-zookeeper' , 'hash14/'+name_format+'-zookeeper' , 1, 2181, username);//Run Zookeeper as Deployment
	ExposeDeployment(shelljs, name_format + '-zookeeper', 2181, 'ClusterIP', username);//Expose Zookeeper Service

	RunDeployment(shelljs, name_format + '-nimbus' , 'hash14/'+name_format+'-nimbus' , 1, 6627, username);//Run Nimbus as Deployment
	ExposeDeployment(shelljs, name_format + '-nimbus', 6627, 'ClusterIP', username);//Expose Nimbus Service
	
	RunDeployment(shelljs, name_format + '-supervisor' , 'hash14/'+name_format+'-supervisor' , nbReplicas, '' , username);//Run Supervisor as Deployment
		
	RunDeployment(shelljs, name_format + '-ui' , 'hash14/'+name_format+'-ui' , 1, 8080, username);//Run Nimbus as Deployment
	ExposeDeployment(shelljs, name_format + '-ui', 8080, 'NodePort', username);//Expose Nimbus Service

	req.session.nodePort = GetNodePort(shelljs, name_format +'-ui');
}

function GetNodePort(shelljs, deployment_name){
	
var svcInfo=sh.exec('kubectl get -o json service ' + deployment_name , {silent:false});
var svcInfoToJSON = JSON.parse(svcInfo);
console.log("Node Port:  " + svcInfoToJSON["spec"]["ports"][0]["nodePort"]);
var nodePort = svcInfoToJSON["spec"]["ports"][0]["nodePort"];

return nodePort;
}

function RunStormTopology(shelljs, fs){
	
	var microservice = req.session.microservices;
	var appname = req.session.projectname;
	var username = req.session.username;
	var name_format = microservice+'-'+username+'-'+appname;

	var giturl = req.body.giturl;
	var getPath = giturl.split('/');
	console.log(getPath[4]);//path of jar file.

	var dir = 'users/' + username + '/' + appname + '/' + getPath[4];
	var classname=req.body.classname;
	var nameTopo=req.body.toponame;
	shelljs.exec('git clone https:\/\/github.com/Chisha14/StormApp ' + dir, {silent:false}).stdout;
	
	var writetoStart="#!/bin/sh\n/configure.sh ${"+req.session.zookeeperServiceHost+":-$1} ${" + req.session.nimbusServiceHost + ":-$2}\nexec /usr/local/storm/apache-storm-0.9.3/bin/storm jar storm-example/*.jar " + classname + " " + nameTopo + " remote";

	fs.writeFileSync(dir+'/start.sh', writetoStart, function (err) {
                if (err) throw err;
        	console.log('Start.sh Saved!');
        });

	var toAppendDockerfile = "RUN git clone " + giturl + "\nENTRYPOINT [\"/start.sh\"]\n";

	fs.appendFileSync(dir+'/Dockerfile', toAppendDockerfile, function (err) {
                if (err) throw err;
        	console.log('Dockerfile Saved !');
    });
		
	BuildImage(shelljs, 'hash14/'+name_format+'-topo ' , dir);//Build topology
	PushImage(shelljs,'hash14/'+name_format+'-topo');//Push topology
	RunDeployment(shelljs, name_format + '-topo' , 'hash14/'+name_format+'-topo' , 1, '', username);//Run topology as Deployment
}