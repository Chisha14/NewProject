var express = require('express');
var mysql = require('mysql');
var path = require('path');
var session = require('express-session');
var bodyParser = require('body-parser');
var fs = require('fs');
var sh = require('shelljs');
var dockerHubAPI = require('docker-hub-api');
var HashTable = require('hashtable');
var exec = require('child_process').exec, child;
var DOCKER_HUB_USERNAME="hash14";
var DOCKER_HUB_PASSWORD="chishash14";

//var K8s = require('k8s');


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

//////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/deletesession', function(req, res) {//Clear all session variables. 
	console.log('Deleting sessions...');
	req.session.destroy();
	res.end();
});//end post

/////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/stormtopology', function(req, res) {//View and build a Storm topology...

	var dir = 'users/' + req.session.username + '/' + req.body.projectname;

	req.session.microservices = req.body.microservices;
    req.session.projectname = req.body.projectname;

	PrepareStorm(sh, dir, fs);

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
	
    RunStorm(sh , dir);

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

	RunStormTopology(sh, fs);
	
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

	sh.exec('mkdir -p ' + dir + '/Storm', {silent:false}).stdout;
	PrepareStorm(sh, dir + '/Storm', fs);
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

	RunStorm(shelljs, dir + '/Storm');
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


