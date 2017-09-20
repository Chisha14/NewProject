var express = require('express');
var mysql = require('mysql');
var path = require('path');
var session = require('express-session');
var bodyParser = require('body-parser');
var fs = require('fs');
var sh = require('shelljs');
var dockerHubAPI = require('docker-hub-api');
var exec = require('child_process').exec, child;
var DOCKER_HUB_USERNAME="hash14";
var DOCKER_HUB_PASSWORD="chishash14";

/////////////////////////////////////////////////////////////////////////////////////////////////importing modules;

dockerHubAPI.setCacheOptions({enabled: true, time: 60}); // This will enable the cache and cache things for 60 seconds 

dockerHubAPI.login(DOCKER_HUB_USERNAME, DOCKER_HUB_PASSWORD).then(function(info) {
    console.log(`My Docker Hub login token is '${info.token}' !`);
}).catch(function (err) {
     console.log(err);
});


dockerHubAPI.user(DOCKER_HUB_USERNAME).then(function(info) {
console.log("Check  " + info['username']);
       for(var i = 0 ; i < info.length ; i++){console.log("Check  " + info[i]);}
}).catch(function (err) {
     console.log(err);
});

var app = express();
var server_port = 3000;
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "bdlaas"
});
con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");

});

/////////////////////////////////////////////////////////////////////////////////////////////////initializing variables

app.use(bodyParser.urlencoded({ extended : true }));
app.use(session({secret: 'ssshhhhh'}));
app.use(express.static(__dirname + '/'));
app.set('views', path.join(__dirname, 'views')); // here the .ejs files is in views folders
app.set('view engine', 'ejs');

/////////////////////////////////////////////////////////////////////////////////////////////////configuring app settings 

app.post('/home', function(req, res) {//This service is called in "signin and registration page".

//req.session.username = req.body.username;
req.session.username = "hash";

if(req.body.signinpassword == null){//Check if he wants to register or signin.

con.query("Insert into users (name,email,username,password) VALUES ('"+req.body.name+"','"+req.body.email+"','"+req.body.username +"','"+req.body.password+"')",function(err, result){

	if (err)
	 throw err;

	console.log("User added succesfully");

});//end query

}//end if

var dir = 'users/' + req.session.username;
if (!fs.existsSync(dir)){
	fs.mkdirSync(dir);
}

res.render('home', { //render the index.ejs
  name:req.session.username
  });//end rendering page
});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/checkusername', function(req, res) {//Check if username if exists or not, this service is called in "signin and registration page".
var obj={};

con.query("SELECT * FROM users where username = '" + req.query.username + "'",function(err, result){    

		console.log(req.query.username + " result: " + result.length);
		obj.countuser = result.length;

		res.header('Content-type','application/json');
		res.header('Charset','utf8');
		res.send(req.query.callback + '('+ JSON.stringify(obj) + ');');

	});//end query

});//end get

/////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/checkpassword', function(req, res) {//Check username and password if satisfied or not, Used in signin page.
var obj={};

con.query("SELECT password FROM users where username = '" + req.query.username + "'",function(err, result){    

		console.log(req.query.username + " password: " + result[0].password);
		obj.pass =  result[0].password;
		obj.name = req.query.username;
		res.header('Content-type','application/json');
		res.header('Charset','utf8');
		res.send(req.query.callback + '('+ JSON.stringify(obj) + ');');
		res.end();
	});//end query
});//end get

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/createproject', function(req, res) {//Create project directory for user(use "mkdir projectname" and send it to server).
	console.log(req.body.microservices);
	var dir = 'users/' + req.session.username + '/' + req.body.projectname;
	if (!fs.existsSync(dir)){
	    fs.mkdirSync(dir);
	}
	req.session.microservices = req.body.microservices;
	req.session.projectname = req.body.projectname;

	res.render('createproject', { //render the index.ejs
	  microservices:req.body.microservices,
	  projectname:req.body.projectname
	});//end rendering page

});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/updateproject', function(req, res) {//Create project directory for user(use "mkdir projectname" and send it to server).
        console.log(req.session.microservices);
        var dir = 'users/' + req.session.username + '/' + req.session.projectname;
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        res.render('createproject', { //render the index.ejs
          microservices:req.session.microservices,
          projectname:req.session.projectname
        });//end rendering page

});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////


app.get('/selectproject', function(req, res) {//Select project from the list

var envs = [];
var apps = [];
if(req.query.app != null){
	console.log("APP: " + req.query.app + " ENV: " + req.query.env);
	req.session.projectname = req.query.app;
	req.session.microservices = req.query.env;
}

dockerHubAPI.repositories(DOCKER_HUB_USERNAME).then(function(info) {

                for(var i = 0 ; i < info.length ; i++){
                        var splitImage = info[i].name.split('/');
                        var splitEnvAppUser = splitImage[0].split('-');
                        //console.log(splitEnvAppUser[0] + " here " + splitEnvAppUser[2]);

                        if(splitEnvAppUser[1] == req.session.username){
                                apps.push(splitEnvAppUser[2]);
                                envs.push(splitEnvAppUser[0]);
                        }

                }
                req.session.envs = envs;
                req.session.apps = apps;
                console.log(envs + " here " + apps);
                res.render('selectproject', { //render the services.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname
                });//end rendering page
                res.end();
        });
	
});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/apacheservice', function(req, res) {//Create Dockerfile, and (build and push to our Docker Hub) image for user.
	var envs = [];
	var apps = [];
	var dir = 'users/' + req.session.username + '/' + req.session.projectname;
	var githublink = req.body.githublink;
	var content = "FROM hash14/apache\nRUN git clone " + githublink + " /var/www/html";
	var imageName = 'hash14/'+ req.session.microservices + '-' + req.session.username + '-' + req.session.projectname;
	fs.writeFile(dir+'/Dockerfile', content, function (err) {
		sh.exec('sudo docker build -t ' + imageName + ' ' + dir, {silent:false}).stdout;
		//sh.exec('sudo docker push ' + imageName , {silent:false}).stdout;
		
		if (err) throw err;
		console.log('Saved!');
		//res.end();
	});
	dockerHubAPI.repositories(DOCKER_HUB_USERNAME).then(function(info) {

		for(var i = 0 ; i < info.length ; i++){
			var splitImage = info[i].name.split('/');
			var splitEnvAppUser = splitImage[0].split('-');
			//console.log(splitEnvAppUser[0] + " here " + splitEnvAppUser[2]);
			
			if(splitEnvAppUser[0] == req.session.microservices && splitEnvAppUser[1] == req.session.username){
				apps.push(splitEnvAppUser[2]);
				envs.push(splitEnvAppUser[0]);
			}
		
		}
		req.session.envs = envs;
		req.session.apps = apps;
		console.log(envs + " here " + apps);
		res.render('services', { //render the services.ejs
		  envss:req.session.envs,
		  appss:req.session.apps,
		  microservices:req.session.microservices,
		  projectname:req.session.projectname
		});//end rendering page
		res.end();
	});	
});//end post

//////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/deletesession', function(req, res) {//Clear all session variables. 
	console.log('Deleting sessions...');
	req.session.destroy();
	res.end();
});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/runapacheapp', function(req, res) {//Run application in Kubernetes after specifying some options .

        console.log('Using Kubernetes');
        //kubeapi.get('/namespaces/default/replicationcontrollers', function(err, data){console.log(data + ' errors: ' + err)})

        var nbOfReplicas = req.body.nbreplicas;
        var appName = req.session.projectname;
        var imageName = 'hash14/' + req.session.microservices + '-' + req.session.username + '-' +  req.session.projectname;
        console.log(imageName);
        if(nbOfReplicas == null)
                nbOfReplicas = 1;
        sh.exec('kubectl run ' + appName + ' --image=' + imageName + ' --replicas=' + nbOfReplicas + ' --port=80', {silent:false}).stdout;
        sh.exec('kubectl expose deployment ' + appName + ' --type=NodePort', {silent:false}).stdout;
		
	var svcInfo=sh.exec('kubectl get -o json service ' + appName , {silent:false});
	var svcInfoToJSON = JSON.parse(svcInfo);
	console.log("Node Port:  " + svcInfoToJSON["spec"]["ports"][0]["nodePort"]);
	req.session.nodePort = svcInfoToJSON["spec"]["ports"][0]["nodePort"];
        res.render('yourrunningapp', { //render the services.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
		  nodePort: req.session.nodePort
                });//end rendering page

});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/deleteapacheapp', function(req, res) {//Delete application in Kubernetes, Docker Hub, and FileSystem...

	console.log('Deleteing apache app');
	var appName = req.session.projectname;
	var imageName = 'hash14/' + req.session.microservices + '-' + req.session.username + '-' +  req.session.projectname;
	console.log(imageName);
	sh.exec('kubectl delete rc ' + appName, {silent:false}).stdout;
	sh.exec('curl -X DELETE -u ' + DOCKER_HUB_USERNAME +":" + DOCKER_HUB_PASSWORD + ' https://index.docker.io/v1/repositories/default/'+imageName, {silent:false}).stdout;
	sh.exec('rm -rf users/' + req.session.username + '/' + req.session.projectname, {silent:false}).stdout;

});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/stormtopology', function(req, res) {//View and build a Storm topology...

	var dir = 'users/' + req.session.username + '/' + req.body.projectname;

	req.session.microservices = req.body.microservices;
        req.session.projectname = req.body.projectname;

	if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }

	var zookeeperName = "STORM_"+req.session.username+"_"+req.session.projectname+"_ZOOKEEPER_SERVICE_HOST";
	var nimbusName = "STORM_"+req.session.username+"_"+req.session.projectname+"_NIMBUS_SERVICE_HOST";

	//var zookeeperName = req.session.projectname+"ZOOKEEPER_SERVICE_HOST";
	//var nimbusName = req.session.projectname+"NIMBUS_SERVICE_HOST";

	var capZookeeperName = zookeeperName.toUpperCase();
	var capNimbusName = nimbusName.toUpperCase();
	req.session.zookeeperServiceHost = capZookeeperName;

        sh.exec('git clone https:\/\/github.com/Chisha14/StormTopology ' + dir, {silent:false}).stdout;

	var nimbus="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1}\nexec bin/storm nimbus"
	fs.writeFile(dir+'/Storm-Nimbus/start.sh', nimbus, function (err) {
                if (err) throw err;
                console.log('Saved!');
        });
	var supervisor="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1} ${"+capNimbusName+":-$2}\nexec bin/storm supervisor";
        fs.writeFile(dir+'/Storm-Supervisor/start.sh', supervisor, function (err) {
                if (err) throw err;
                console.log('Saved!');
        });
        var ui="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1} ${"+capNimbusName+":-$2}\nexec bin/storm ui";

        fs.writeFile(dir+'/Storm-UI/start.sh', ui, function (err) {
                if (err) throw err;
                console.log('Saved!');
        });

        res.render('stormtopology', { //render the index.ejs
          microservices:req.session.microservices,
          projectname:req.session.projectname
        });//end rendering page

});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/runstorm', function(req, res) {//build Storm topology and ...

        var microservice = req.session.microservices;
	var appname = req.session.projectname;
	var username = req.session.username;
	var dir = 'users/' + username + '/' + appname;
	var nameFormat = microservice+'-'+username+'-'+appname;
	var nbReplicas = req.body.supervisornodes;

	sh.exec('sudo docker build -t hash14/'+nameFormat+'-zookeeper '+dir+'/Zookeeper' , {silent:false}).stdout;
	sh.exec('sudo docker push hash14/'+nameFormat+'-zookeeper' , {silent:false}).stdout;

 	sh.exec('sudo docker build -t hash14/'+nameFormat+'-nimbus '+dir+'/Storm-Nimbus' , {silent:false}).stdout;
        sh.exec('sudo docker push hash14/'+nameFormat+'-nimbus' , {silent:false}).stdout;

	sh.exec('sudo docker build -t hash14/'+nameFormat+'-supervisor '+dir+'/Storm-Supervisor' , {silent:false}).stdout;
        sh.exec('sudo docker push hash14/'+nameFormat+'-supervisor' , {silent:false}).stdout;

	sh.exec('sudo docker build -t hash14/'+nameFormat+'-ui '+dir+'/Storm-UI' , {silent:false}).stdout;
        sh.exec('sudo docker push hash14/'+nameFormat+'-ui' , {silent:false}).stdout;

	sh.exec('kubectl run ' + nameFormat + '-zookeeper --image=hash14/'+nameFormat+'-zookeeper --replicas=1 --port=2181' , {silent:false}).stdout;
	sh.exec('kubectl expose deployment '+nameFormat+'-zookeeper --port=2181 --type=ClusterIP' , {silent:false}).stdout;

	sh.exec('kubectl run ' + nameFormat + '-nimbus --image=hash14/'+nameFormat+'-nimbus --replicas=1 --port=6627' , {silent:false}).stdout;
	sh.exec('kubectl expose deployment '+ nameFormat + '-nimbus --port=6627 --type=ClusterIP' , {silent:false}).stdout;

	sh.exec('kubectl run ' + nameFormat + '-supervisor --image=hash14/'+nameFormat+'-supervisor --replicas='+nbReplicas , {silent:false}).stdout;

	sh.exec('kubectl run ' + nameFormat + '-ui --image=hash14/'+nameFormat+'-ui --replicas=1 --port=8080' , {silent:false}).stdout;
        sh.exec('kubectl expose deployment '+ nameFormat + '-ui --port=8080 --type=NodePort' , {silent:false}).stdout;

	var svcInfo=sh.exec('kubectl get -o json service ' + nameFormat +'-ui' , {silent:false});
        var svcInfoToJSON = JSON.parse(svcInfo);
        console.log("Node Port:  " + svcInfoToJSON["spec"]["ports"][0]["nodePort"]);
	req.session.nodePort = svcInfoToJSON["spec"]["ports"][0]["nodePort"];

	res.render('runstormapps', { //render the index.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                  nodePort: req.session.nodePort
                });//end rendering page

});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/runtopo', function(req, res) {//build Storm topology and ...

        var microservice = req.session.microservices;
        var appname = req.session.projectname;
        var username = req.session.username;
        var nameFormat = microservice+'-'+username+'-'+appname;

	var zookeeperName = "STORM_"+req.session.username+"_"+req.session.projectname+"_ZOOKEEPER_SERVICE_HOST";
        var nimbusName = "STORM_"+req.session.username+"_"+req.session.projectname+"_NIMBUS_SERVICE_HOST";

        var capZookeeperName = zookeeperName.toUpperCase();
        var capNimbusName = nimbusName.toUpperCase();
	var giturl = req.body.giturl;
	var getPath = giturl.split('/');
	console.log(getPath[4]);//path of jar file.

        var dir = 'users/' + username + '/' + appname + '/' + getPath[4];
        sh.exec('git clone https:\/\/github.com/Chisha14/StormApp ' + dir, {silent:false}).stdout;

        var classname=req.body.classname;
	var nameTopo=req.body.toponame;
	var writetoStart="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1} ${" + capNimbusName + ":-$2}\nexec /usr/local/storm/apache-storm-0.9.3/bin/storm jar storm-example/*.jar " + classname + " " + nameTopo + " remote";

	fs.writeFileSync(dir+'/start.sh', writetoStart, function (err) {
                if (err) throw err;
        	console.log('Saved Start.sh!');
        });

	var toAppendDockerfile = "RUN git clone " + giturl + "\nENTRYPOINT [\"/start.sh\"]\n";

	fs.appendFileSync(dir+'/Dockerfile', toAppendDockerfile, function (err) {
		console.log('Checking Dockerfile...!');
                if (err) throw err;
        	console.log('Saved Dockerfile!');
        });

	  sh.exec('sudo docker build -t hash14/'+nameFormat+'-topo '+dir , {silent:false}).stdout;
          sh.exec('sudo docker push hash14/'+nameFormat+'-topo' , {silent:false}).stdout;
          sh.exec('kubectl run '+ nameFormat + '-topo --image=hash14/'+nameFormat+'-topo ' , {silent:false}).stdout;
	res.render('runtopo', { //render the index.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                  nodePort: req.session.nodePort
                });//end rendering page

});
/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/kafkacluster', function(req, res) {//build Storm topology and ...

	req.session.microservices = req.body.microservices;
        req.session.projectname = req.body.projectname;

	var microservice = req.session.microservices;
        var appname = req.session.projectname;
        var username = req.session.username;

        var dir = 'users/' + username + '/' + appname;
        sh.exec('git clone https:\/\/github.com/Chisha14/KafkaCluster.git ' + dir, {silent:false}).stdout;

	res.render('kafkacluster', { //render the index.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                });//end rendering page


});

/////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/kafkacluster', function(req, res) {//build Storm topology and ...

        var microservice = req.session.microservices;
        var appname = req.session.projectname;
        var username = req.session.username;
        var nameFormat = microservice+'-'+username+'-'+appname;

        var dir = 'users/' + username + '/' + appname + "/Kafka";
        sh.exec('mkdir ' + dir, {silent:false}).stdout;

        sh.exec('git clone https:\/\/github.com/Chisha14/KafkaCluster.git ' + dir, {silent:false}).stdout;
	var toAppend = "--override zookeeper.connect=$"+req.session.zookeeperServiceHost+":2181";
	console.log("Appending to start.sh...");
	fs.appendFileSync(dir+'/start.sh', toAppend, function (err) {
                console.log('Appending to start.sh...!');
                if (err) throw err;
                console.log('Saved start.sh!');
        });


	res.render('kafkacluster', { //render the index.ejs
		  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                  nodePort: req.session.nodePort
                });//end rendering page


});

////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/runkafka', function(req, res) {//build Storm topology and ...

        var microservice = req.session.microservices;
        var appname = req.session.projectname;
        var username = req.session.username;
        var nameFormat = microservice+'-'+username+'-'+appname;

        var dir = 'users/' + username + '/' + appname;
        sh.exec('mkdir ' + dir, {silent:false}).stdout;

	if(req.session.zookeeperServiceHost != ""){
        	sh.exec('sudo docker build -t hash14/'+nameFormat+'-kafka '+dir+'/Kafka' , {silent:false}).stdout;
        	sh.exec('sudo docker push hash14/'+nameFormat+'-kafka' , {silent:false}).stdout;
        	sh.exec('kubectl run '+ nameFormat + '-kafka --image=hash14/'+nameFormat+'-kafka --port=9200 --replicas='+req.body.kafkabrokers , {silent:false}).stdout;

        res.render('runtopo', { //render the topo.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                  nodePort: req.session.nodePort
                });//end rendering page
	}
	else{
		console.log("Loadinggg....");
	}
});

////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/hadoopcluster', function(req, res) {//build Storm topology and ...

        req.session.microservices = req.body.microservices;
        req.session.projectname = req.body.projectname;

        var microservice = req.session.microservices;
        var appname = req.session.projectname;
        var username = req.session.username;

        var dir = 'users/' + username + '/' + appname;
        sh.exec('mkdir ' + dir, {silent:false}).stdout;

        sh.exec('git clone https:\/\/github.com/Chisha14/Hadoop.git ' + dir, {silent:false}).stdout;
        sh.exec('sudo chmod +x ' + dir +'/BuildHadoop.sh', {silent:false}).stdout;

        res.render('hadoopcluster', { //render the index.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                });//end rendering page
});

////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/starthadoopcluster', function(req, res) {//build Storm topology and ...

	var microservice = req.session.microservices;
        var appname = req.session.projectname;
        var username = req.session.username;
        var nameFormat = microservice+'-'+username+'-'+appname;

	var appname = req.session.projectname;
        var username = req.session.username;

        var dir = 'users/' + username + '/' + appname;

        var clustersize = req.body.clustersize;
        var dn = req.body.dn;
        var nn = req.body.nn;
        var ns = req.body.ns;
	req.session.nn = nn;
        req.session.dn = dn;
        req.session.ns = ns;


	const testscript = exec('bash ' + dir+'/BuildHadoop.sh ' + nn + ' ' + dn + ' ' + ns + ' ' + clustersize);


	testscript.stdout.on('data', function(data){
	    console.log(data); 
	});

	testscript.stderr.on('data', function(data){
	    console.log(data);
	});

	testscript.on('close', function(data){
	    console.log("finished");

      	res.render('myhadoopcluster', { //render the index.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                  nodePort: 31147

                });//end rendering page
});

});

//////////////////////////////////////////////////////////////////////////////////////////////// 

app.get('/hadooppage', function(req, res) {//build Storm topology and ...

        sh.exec('kubectl delete --namespace=' + req.session.ns + ' svc ' + req.session.nn, {async:false}).stdout;
        sh.exec('kubectl expose deployment ' + req.session.nn + ' --type=NodePort --port=50070 --namespace='+req.session.ns, {async:false}).stdout;

	var svcInfo=sh.exec('kubectl get -o json service ' + req.session.nn +' --namespace='+req.session.ns, {async:false}).stdout;
        var svcInfoToJSON = JSON.parse(svcInfo);
        console.log("Node Port:  " + svcInfoToJSON["spec"]["ports"][0]["nodePort"]);
        var nodePort = svcInfoToJSON["spec"]["ports"][0]["nodePort"];
        res.redirect('http:\/\/localhost:'+nodePort);

});

/////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/yarnpage', function(req, res) {//build Storm topology and ...

          sh.exec('kubectl delete --namespace=' + req.session.ns + ' svc ' + req.session.nn, {async:false}).stdout;
          sh.exec('kubectl expose deployment ' + req.session.nn + ' --type=NodePort --port=8088 --namespace='+req.session.ns, {async:false}).stdout;

          var svcInfo=sh.exec('kubectl get -o json service ' + req.session.nn +' --namespace='+req.session.ns, {async:false}).stdout;
          var svcInfoToJSON = JSON.parse(svcInfo);
          console.log("Node Port:  " + svcInfoToJSON["spec"]["ports"][0]["nodePort"]);
          var nodePort = svcInfoToJSON["spec"]["ports"][0]["nodePort"];

          res.redirect('http:\/\/localhost:'+nodePort);
});

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/runmapreduce', function(req, res) {//build Storm topology and ...

if(req.body.input != ""){

	var appname = req.session.projectname;
        var username = req.session.username;
        var dir = 'users/' + username + '/' + appname;
	sh.exec('mkdir ' + dir + '/Projects', {silent:false}).stdout;
	dir=dir+'/Projects';
	var giturl = req.body.giturl;
        var getPath = giturl.split('/');
        console.log(getPath[4]);//path of jar file.

	sh.exec('kubectl config set-context ' + req.session.nn + ' --namespace='+req.session.ns, {silent:false}).stdout;
	sh.exec('kubectl config use-context ' + req.session.nn, {silent:false}).stdout;
	var pods=sh.exec('kubectl get pods | grep ' + req.session.nn  + '--*',{silent:false}).stdout;
	var getPod=pods.split(' ');
        sh.exec('kubectl exec -i ' + getPod[0] + ' hadoop fs -- -mkdir -p /user/root/'+req.body.input, {silent:false}).stdout;
	sh.exec('kubectl exec -i ' + getPod[0] + ' git clone ' + giturl, {silent:false}).stdout;
        sh.exec('kubectl exec -i ' + getPod[0] + ' hadoop jar ' + getPath[4] + '/' + req.body.jarname  + ' ' + req.body.classname + ' ' + req.body.input + ' ' + req.body.output, {async:false}).stdout;
}

else{

        sh.exec('kubectl config set-context ' + req.session.nn + ' --namespace='+req.session.ns, {silent:false}).stdout;
        sh.exec('kubectl config use-context ' + req.session.nn, {silent:false}).stdout;
        var pods=sh.exec('kubectl get pods | grep ' + req.session.nn  + '--*',{silent:false}).stdout;
        var getPod=pods.split(' ');
        sh.exec('kubectl exec -i ' + getPod[0] + ' hadoop fs -- -mkdir -p /user/root/input', {silent:false}).stdout;
        sh.exec('kubectl exec -i ' + getPod[0] + ' hadoop jar share/hadoop/mapreduce/hadoop-mapreduce-examples-2.7.2.jar wordcount input ' + req.body.output, {silent:false}).stdout;
}
	res.render('myhadoopcluster', { //render the index.ejs
                  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                  nodePort: 31147

                });//end rendering page

});

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/dependencygraph', function(req, res) {//build Storm topology and ...

	req.session.microservices = req.body.microservices;
        req.session.projectname = req.body.projectname;

        var microservice = req.session.microservices;
        var appname = req.session.projectname;
	var username =  req.session.username;
        var dir = 'users/' + username + '/' + appname;

        sh.exec('mkdir -p ' + dir, {silent:false}).stdout;

	var zookeeperName = "GRAPH_"+req.session.username+"_"+req.session.projectname+"_ZOOKEEPER_SERVICE_HOST";
        var nimbusName = "GRAPH_"+req.session.username+"_"+req.session.projectname+"_NIMBUS_SERVICE_HOST";

        var capZookeeperName = zookeeperName.toUpperCase();
        var capNimbusName = nimbusName.toUpperCase();

        sh.exec('mkdir -p ' + dir + '/Storm', {silent:false}).stdout;
        sh.exec('git clone https:\/\/github.com/Chisha14/StormTopology ' + dir +'/Storm', {silent:false}).stdout;

        var nimbus="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1}\nexec bin/storm nimbus";
        fs.writeFile(dir+'/Storm/Storm-Nimbus/start.sh', nimbus, function (err) {
                if (err) throw err;
                console.log('Saved!');
        });

        var supervisor="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1} ${"+capNimbusName+":-$2}\nexec bin/storm supervisor";
	fs.writeFile(dir+'/Storm/Storm-Supervisor/start.sh', supervisor, function (err) {
                if (err) throw err;
                console.log('Saved!');
        });

	var ui="#!/bin/sh\n/configure.sh ${"+capZookeeperName+":-$1} ${"+capNimbusName+":-$2}\nexec bin/storm ui";

        fs.writeFile(dir+'/Storm/Storm-UI/start.sh', ui, function (err) {
                if (err) throw err;
                console.log('Saved!');
        });

	res.render('arbor', { //render the index.ejs

                });//end rendering page


});

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/submitgraph', function(req, res) {//build Storm topology and ...

        var username = req.session.username;
	var hadoopName = req.body.hadoopClusterName;
	var kafkaName = req.body.kafkaClusterName;
	var stormName = req.body.stormClusterName;

	var microservice = req.session.microservices;
        var appname = req.session.projectname;
        var username = req.session.username;
        var nameFormat = microservice+'-'+username+'-'+appname;

        var dir = 'users/' + username + '/' + appname;

	var ns = username;

	sh.exec('kubectl create namespace ' + ns, {silent:false}).stdout;


	sh.exec('kubectl config set-context '+ns+' --namespace='+ns, {silent:false}).stdout;


	sh.exec('kubectl config use-context '+ns, {silent:false}).stdout;

	var nbHadoop=req.body.nbHadoopNodes;
	var nbKafka=req.body.nbKafkaNodes;
	var nbStorm=req.body.nbStormNodes;

////////////////////////////////////////////////////////////////////Storm

	var zookeeperName = "GRAPH_"+req.session.username+"_"+req.session.projectname+"_ZOOKEEPER_SERVICE_HOST";
	var nimbusName = "GRAPH_"+req.session.username+"_"+req.session.projectname+"_NIMBUS_SERVICE_HOST";

	    var capZookeeperName = zookeeperName.toUpperCase();
        var capNimbusName = nimbusName.toUpperCase();

	    sh.exec('sudo docker build -t hash14/'+nameFormat+'-zookeeper '+dir+'/Storm/Zookeeper' , {async:false}).stdout;
        sh.exec('sudo docker push hash14/'+nameFormat+'-zookeeper' , {async:false}).stdout;

        sh.exec('sudo docker build -t hash14/'+nameFormat+'-nimbus '+dir+'/Storm/Storm-Nimbus' , {async:false}).stdout;
        sh.exec('sudo docker push hash14/'+nameFormat+'-nimbus' , {async:false}).stdout;

        sh.exec('sudo docker build -t hash14/'+nameFormat+'-supervisor '+dir+'/Storm/Storm-Supervisor' , {silent:false}).stdout;
        sh.exec('sudo docker push hash14/'+nameFormat+'-supervisor' , {silent:false}).stdout;

        sh.exec('sudo docker build -t hash14/'+nameFormat+'-ui '+dir+'/Storm/Storm-UI' , {silent:false}).stdout;
        sh.exec('sudo docker push hash14/'+nameFormat+'-ui' , {silent:false}).stdout;

        sh.exec('kubectl run ' + nameFormat + '-zookeeper --image=hash14/'+nameFormat+'-zookeeper --replicas=1 --port=2181 --namespace='+ns , {silent:false}).stdout;
        sh.exec('kubectl expose deployment '+nameFormat+'-zookeeper --port=2181 --type=ClusterIP --namespace='+ns , {silent:false}).stdout;

        sh.exec('kubectl run ' + nameFormat + '-nimbus --image=hash14/'+nameFormat+'-nimbus --replicas=1 --port=6627 --namespace='+ns , {silent:false}).stdout;
        sh.exec('kubectl expose deployment '+ nameFormat + '-nimbus --port=6627 --type=ClusterIP --namespace='+ns , {silent:false}).stdout;

        sh.exec('kubectl run ' + nameFormat + '-supervisor --image=hash14/'+nameFormat+'-supervisor --replicas='+nbStorm+' --namespace='+ns , {silent:false}).stdout;

        sh.exec('kubectl run ' + nameFormat + '-ui --image=hash14/'+nameFormat+'-ui --replicas=1 --port=8080 --namespace='+ns , {silent:false}).stdout;
        sh.exec('kubectl expose deployment '+ nameFormat + '-ui --port=8080 --type=NodePort --namespace='+ns , {silent:false}).stdout;

	console.log("Storm have been finished");
////////////////////////////////////////////////////////////////////Kafka
        sh.exec('mkdir -p ' + dir +'/Kafka', {silent:false}).stdout;

        sh.exec('git clone https:\/\/github.com/Chisha14/KafkaCluster.git ' + dir +'/Kafka', {silent:false}).stdout;
        var toAppend = "--override zookeeper.connect=$"+capZookeeperName+":2181";
        console.log("Appending to start.sh...");
        fs.appendFileSync(dir+'/Kafka/start.sh', toAppend, function (err) {
                console.log('Appending to start.sh...!');
                if (err) throw err;
                console.log('Saved start.sh!');
        });
	sh.exec('sudo docker build -t hash14/'+nameFormat+'-kafka '+dir+'/Kafka' , {silent:false}).stdout;
	sh.exec('sudo docker push hash14/'+nameFormat+'-kafka' , {silent:false}).stdout;
	sh.exec('kubectl run '+ nameFormat + '-kafka --image=hash14/'+nameFormat+'-kafka --port=9200 --replicas='+nbKafka+' --namespace='+ns , {silent:false}).stdout;
	console.log("Kafka have been finished");


////////////////////////////////////////////////////////////////////Kafka
	var nn = hadoopName + "-nn";
        var dn = hadoopName + "-dn";

	req.session.ns = ns;
	req.session.nn = nn;
        sh.exec('mkdir -p ' + dir + '/Hadoop', {silent:false}).stdout;

        sh.exec('git clone https:\/\/github.com/Chisha14/Hadoop.git ' + dir +'/Hadoop', {silent:false}).stdout;
        sh.exec('sudo chmod +x ' + dir +'/Hadoop/BuildHadoop.sh', {silent:false}).stdout;

        const testscript = exec('bash ' + dir+'/Hadoop/BuildHadoop.sh ' + nn + ' ' + dn + ' ' + ns + ' ' + nbHadoop);

        testscript.stdout.on('data', function(data){
            console.log(data);
        });

        testscript.stderr.on('data', function(data){
            console.log(data);
        });

        testscript.on('close', function(data){
            console.log("finished");


        res.render('myhadoopcluster', { //render the index.ejs
		  envss:req.session.envs,
                  appss:req.session.apps,
                  microservices:req.session.microservices,
                  projectname:req.session.projectname,
                  nodePort: 31147
                });//end rendering page
	});//hadoop finishes;

});

/////////////////////////////////////////////////////////////////////////////////////////////////

app.listen(server_port, function(){//Tell the server to listen to server_port. 
	console.log("Listening on port : " + server_port);
});

/////////////////////////////////////////////////////////////////////////////////////////////////end


